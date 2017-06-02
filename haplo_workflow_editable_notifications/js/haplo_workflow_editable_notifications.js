/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/*
    For each notification in the workflow:
    
    1) Define a state, transition and text where someone must write and send a notification.
    These are entirely your responsibility. This feature will prevent all transitions until
    a notification has been written, and then will send it on transition.

    2) use("haplo:editable_notification", spec)
    where spec has properties:
        name - unique name of the notification
        displayName - for notification in list
        state - state where user will send a notification
        transition - (optional but advised for best UX) which transition will be
            performed when the notification has been made
        subject - (optional) override email subject, can be a string or a function
            called with the M parameter for per-instance subjects
        getNotificationTemplateName(M) - (optional) function to get template name
        sendEmail - (optional) specification for M.sendEmail to send the email

    3) P.implementService("haplo:editable_notification:template_definition:TEMPLATE_NAME", function() { ... });
    where TEMPLATE_NAME is the name of the template, returned from getNotificationTemplateName().
    However, you'll probaly just want to use the default template name, which is
        PLUGIN_NAME:WORKFLOW_NAME:NOTIFICATION_NAME
    eg "example_plugin:approval:accepted"

    Your service should return an object with these properties:
        plugin - plugin which implements this
        sections - array of [sort, name, xml file, displayName]
        buildTextForEditing(M,builder) - function to build text (optional)

    This separation of notifications and templates is intended to give you more flexibility
    in how templates are created. For example, this mechanism allows you to have pluggable
    implementations in your workflows.

    Your buildTextForEditing() function is called with a builder object, see the TextBuilder
    implementation below. This allows you to
       a) define stock text (which later we'll allow admins to edit)
       b) add rendered templates for stuff which can't be put in template
       c) replace [KEY] values in all text with values generated for the workflow,
          for inserting key values even in edited text.

    TODO: Document builder interface

    IMPORTANT: Try to get as much of your notification as possible as possible using
    the XML files. This maximises the amount of the notification which will be
    editable by the administrators.

    Your XML files are not strictly correct XML, as they should *not* include the root
    <doc> element. But otherwise they're just the document text XML.


    There's also an optional configuration of the notification system for the entire
    workflow. You probably won't need to use it.

    use("haplo:editable_notification:config", config)
    where config has properties:
        panel - panel sort for the sent Notifications list

*/

var DEFAULT_NOTIFICATION_LIST_SORT = 1480;   // can be overriden with config.panel

// --------------------------------------------------------------------------

P.db.table("notifications", {
    workUnitId: {type:"int", indexed:true},
    name: {type:"text"},                        // which notification
    pending: {type:"boolean"},                  // whether this notification can be sent
    text: {type:"text"},                        // rich text XML document
    sentAt: {type:"datetime", nullable:true},   // when it was sent
    sentBy: {type:"user", nullable:true}        // who sent it
});

// --------------------------------------------------------------------------

var workflows = {};
var configs = {};

var getWorkflowNotificationInfo = function(workUnit, name) {
    var info;
    var workflowNotifications = workflows[workUnit.workType];
    if(workflowNotifications) { info = workflowNotifications[name]; }
    if(!info) { O.stop("Can't find notification definition"); }
    return info;
};

var getPendingNotification = function(M, name) {
    var pendingq = P.db.notifications.select().
        where("workUnitId","=",M.workUnit.id).
        where("name","=",name).
        where("pending","=",true);
    return pendingq.length ? pendingq[0] : undefined;
};

var getSubjectFromSpec = function(M, spec) {
    if(!spec.subject) { return; }
    return (typeof(spec.subject) === "function") ? spec.subject(M) : spec.subject;
};

// --------------------------------------------------------------------------

P.workflow.registerWorkflowFeature("haplo:editable_notification:config",
    function(workflow, config) {
        configs[workflow.fullName] = _.extend(configs[workflow.fullName] || {}, config);
    }
);

P.workflow.registerWorkflowFeature("haplo:editable_notification",
    function(workflow, spec) {
        var requiresBasicSetup = false;
        // Store the workflow spec for use later
        var workflowNotifications = workflows[workflow.fullName];
        if(!workflowNotifications) {
            workflows[workflow.fullName] = workflowNotifications = {};
            requiresBasicSetup = true; // no notifications defined yet
        }
        if(!spec.name || (spec.name in workflowNotifications)) { throw new Error("no name or duplicate name"); }
        workflowNotifications[spec.name] = {workflow:workflow, spec:spec};

        var state = spec.state;
        if(!state) { throw new Error("No state specificed"); }

        // ------------------------------------------------------------------
        // Common functionality for workflow
        if(requiresBasicSetup) {
            workflow.actionPanel({}, actionPanelToDisplaySendNotification);
        }

        // ------------------------------------------------------------------
        // Handlers for the notification on the specified state
        var SELECTOR = {state:state};

        // Add links to notification editor
        workflow.actionPanelTransitionUI(SELECTOR, function(M, builder) {
            if(M.workUnit.isActionableBy(O.currentUser)) {
                builder.link("default",
                    "/do/workflow-notifications/write/"+spec.name+"/"+M.workUnit.id,
                    "Notify: "+spec.displayName,
                    getPendingNotification(M, spec.name) ? "standard" : "primary");
            }
        });

        // Prevent transitions until a notification has been written
        workflow.filterTransition(SELECTOR, function(M, name) {
            if(!getPendingNotification(M, spec.name)) { return false; }
        });

        // Display the notification for review on the transition page
        workflow.transitionUI(SELECTOR, function(M, E, ui) {
            var pending = getPendingNotification(M, spec.name);
            if(!pending) { return; }
            ui.addFormDeferred("top", P.template("review").deferredRender({
                M: M,
                notification: pending
            }));
        });

        // When transitioning, send the notification and mark it as not pending any more
        workflow.observeExit(SELECTOR, function(M, transition) {
            var pending = getPendingNotification(M, spec.name);
            if(pending) {
                // Send notification by email
                if(spec.sendEmail) {
                    var sendSpec = _.clone(spec.sendEmail);
                    var sendView = {
                        spec: spec,
                        url: O.application.url + M.url,
                        subject: getSubjectFromSpec(M, spec),
                        M: M,
                        notification: pending
                    };
                    if("template" in sendSpec) {
                        var callerView = _.clone(sendSpec.view || {});
                        callerView.notification = P.template("email-body").deferredRender(sendView);
                        sendSpec.view = callerView;
                    } else {
                        sendSpec.template = P.template("email-body");
                        sendSpec.view = sendView;
                    }
                    M.sendEmail(sendSpec);
                }
                // Update notification
                pending.pending = false;
                pending.sentAt = new Date();
                pending.sentBy = O.currentUser;
                pending.save();
            }
        });

        // When transitioning to this state as the actionable user, go directly to the notification
        workflow.transitionUIPostTransitionRedirectForActionableUser(SELECTOR, function(M, ui) {
            return "/do/workflow-notifications/write/"+spec.name+"/"+M.workUnit.id;
        });
    }
);

// --------------------------------------------------------------------------

var actionPanelToDisplaySendNotification = function(M, builder) {
    // Which links need to be generated?
    var sent = P.db.notifications.select().
        where("workUnitId","=",M.workUnit.id).
        where("pending","=",false).
        order("sentAt");
    if(sent.length === 0) { return; } // nothing to display

    var config = configs[M.workUnit.workType] || {};
    var notificationInfos = workflows[M.workUnit.workType] || {};

    var panel = builder.panel(config.panel || DEFAULT_NOTIFICATION_LIST_SORT);
    panel.element(0, {title:"Notifications"});

    // Sorting in list done by reading notifications from table, display the links in this order
    var links = [];
    var seen = {};
    _.each(sent, function(notification) {
        if(seen[notification.name]) { return; }
        seen[notification.name] = true;
        var info = notificationInfos[notification.name];
        if(info) { links.push(info.spec); }
    });
    _.each(links, function(spec, index) {
        panel.link(100+index, "/do/workflow-notifications/view/"+spec.name+"/"+M.workUnit.id, spec.displayName);
    });
};

// --------------------------------------------------------------------------

var WRITE_FORM = P.form("write", "form/write.json");

P.respond("GET,POST", "/do/workflow-notifications/write", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"workUnit"}
], function(E, name, workUnit) {
    var info = getWorkflowNotificationInfo(workUnit, name); // stops if not defined
    var M = info.workflow.instance(workUnit);
    if(!M) { O.stop("No workflow"); }
    var pending = getPendingNotification(M, name);
    if(!pending) {
        pending = P.db.notifications.create({
            workUnitId: workUnit.id,
            name: name,
            pending: true
        });
        if(E.request.method === "GET") {
            // Only make the default text for editing if it's needed
            var builder = new TextBuilder(M, name, info);
            pending.text = builder._build();
        }
    }
    var document = {notification:pending.text};
    var form = WRITE_FORM.handle(document, E.request);
    if(form.complete) {
        pending.text = document.notification;
        pending.save();
        if(E.request.parameters.save) { 
            return E.response.redirect(M.url);
        } else {
            return E.response.redirect(M.transitionUrl(info.spec.transition));            
        }
    }
    E.render({
        spec: info.spec,
        M: M,
        form: form
    });
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/workflow-notifications/view", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"workUnit", allUsers:true}
], function(E, name, workUnit) {
    // TODO: Any more permissions checking other than reading objects behind work unit?
    var info = getWorkflowNotificationInfo(workUnit, name); // stops if not defined
    var M = info.workflow.instance(workUnit);
    if(!M) { O.stop("No workflow"); }

    var notifications = P.db.notifications.select().
        where("workUnitId","=",workUnit.id).
        where("name","=",name).
        where("pending","=",false).
        order("sentAt",true);   // put latest notifications first

    E.render({
        spec: info.spec,
        M: M,
        notifications: notifications
    });
});

// --------------------------------------------------------------------------

var TextBuilder = function(M, name, info) {
    this.$M = M;
    this.$name = name;
    this.$info = info;
    var templateName = info.spec.getNotificationTemplateName ?
        info.spec.getNotificationTemplateName(M) :
        M.workUnit.workType+":"+info.spec.name;
    this.$template = O.serviceMaybe("haplo:editable_notification:template_definition:"+templateName);
    if(!this.$template) { O.stop("Can't find template definition "+templateName); }
    this.$interpolations = {};
    this.$sections = [];
    this.$exclude = [];
    this.$excludeAll = false;
    this.$explicitInclude = [];
};

// Add a text in the notification from a deferred render template
TextBuilder.prototype.add = function(sort, deferred) {
    this.$sections.push({
        sort: sort,
        text: P.template("std:render").render(deferred)    // although rendered immediately, ask for a deferred for consistency
    });
    return this;
};

// Add interpolations for the text
TextBuilder.prototype.interpolate = function(interpolations) {
    _.extend(this.$interpolations, interpolations);
    return this;
};

// Exclude a named section
TextBuilder.prototype.exclude = function(name) {
    this.$exclude.push(name);
    return this;
};

// Exclude all sections
TextBuilder.prototype.excludeAll = function() {
    this.$excludeAll = true;
    return this;
};

// Explicitly include a section after excludeAll()
TextBuilder.prototype.include = function(name) {
    if(!this.$excludeAll) { O.stop("Can't call include() before excludeAll()"); }
    this.$explicitInclude.push(name);
    return this;
};

TextBuilder.prototype._build = function() {
    var template = this.$template;
    var plugin = template.plugin;
    if(!plugin) { O.stop("No plugin defined in template"); }
    // Ask template for details
    if(template.buildTextForEditing) { template.buildTextForEditing(this.$M, this); }
    var sections = this.$sections;
    var exclude = this.$exclude;
    var excludeAll = this.$excludeAll;
    var include = this.$explicitInclude;
    // Load sections in the template if they're not excluded
    _.each(template.sections || [], function(s) {
        // s = [sort, name, xml, displayName]
        if(excludeAll) {
            if(include.indexOf(s[1]) === -1) { return; }
        } else if(exclude.indexOf(s[1]) > -1) { return; }
        var file = s[2];
        if(typeof(file) === "string") { file = plugin.loadFile(file); }
        sections.push({
            sort: s[0],
            text: file.readAsString()
        });
    });
    // Sort and join
    var doc = '<doc>';
    _.sortBy(sections,'sort').forEach(function(s) { doc += s.text; });
    doc += '</doc>';
    // Interpolate
    var interpolations = this.$interpolations;
    doc = doc.replace(/\[([A-Z0-9_]+)\]/g, function(m, key) {
        return _.escape(interpolations[key] || key);
    });
    return doc;
};
