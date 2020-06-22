/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/*HaploDoc
node: /haplo_workflow_editable_notifications
title: Editable notifications
sort: 47
--

For each notification in the workflow:

1) Define a state, transition and text where someone must write and send a notification.
These are entirely your responsibility. This feature will prevent all transitions until
a notification has been written, and then will send it on transition.

2) Use the feature. 

h3(feature). use("haplo:editable_notification", spec)

where spec has properties:

| name | unique name of the notification |
| displayName | for notification in list, supports use of @NAME()@ through string interpolation. |
| state | state where user will send a notification |
| transition | (optional but advised for best UX) which transition will be performed when the notification has been made |
| subject | (optional) override email subject, can be a string or a function called with the M parameter for per-instance subjects |
| getNotificationTemplateName(M) | (optional) function to get template name |
| sendEmail | (optional) specification for M.sendEmail for sending the notification by email, can be a spec or a function called with the M parameter for per-instance specs |
| noRedirect | (optional) boolean to prevent redirecting to the notification edit page when transitioning into the state |

To replace the text of "Notify: "+displayName or the indicator, use the text system.

3) Implement the service.

h3(service). P.implementService("haplo:editable_notification:template_definition:TEMPLATE_NAME", function() { ... });

where @TEMPLATE_NAME@ is the name of the template, returned from @getNotificationTemplateName()@.

However, you'll probably just want to use the default template name, which is @PLUGIN_NAME:WORKFLOW_NAME:NOTIFICATION_NAME@, eg. "example_plugin:approval:accepted".

Your service should return an object with these properties:

| plugin | plugin which implements this |
| sections | array of @[sort, name, xml file, displayName]@ |
| @buildTextForEditing(M, builder)@ | function to build text (optional) |

This separation of notifications and templates is intended to give you more flexibility
in how templates are created. For example, this mechanism allows you to have pluggable
implementations in your workflows.

Your @buildTextForEditing()@ function is called with a builder object, see the TextBuilder
implementation below. This allows you to
   a) define stock text (which later we'll allow admins to edit)
   b) add rendered templates for stuff which can't be put in template
   c) replace @[KEY]@ values in all text with values generated for the workflow,
      for inserting key values even in edited text.

h4. Builder interface

|_. function |_. Action |
| add(sort, deferred) | Add a text in the notification from a deferred render template. |
| interpolate(interpolations) | Add interpolations for the text. |
| exclude(name) | Exclude a named section. |
| excludeAll() | Exclude all sections. |
| include(name) | Explicitly include a section after @excludeAll()@ |


*IMPORTANT*: Try to get as much of your notification as possible as possible using the XML files. This maximises the amount of the notification which will be editable by the administrators.

Your XML files are not strictly correct XML, as they should *not* include the root @<doc>@ element. But otherwise they're just the document text XML.

h3(feature). use("haplo:editable_notification:config", config)

This feature optionally allows you to configure the notification system for the entire workflow.

@config@ has properties:

| panel | panel sort for the sent Notifications list |

You probably won't need to use it.

*/

var DEFAULT_NOTIFICATION_LIST_SORT = 1480;   // can be overridden with config.panel

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

var getPropertyFromSpec = function(M, spec, property) {
    if(!spec[property]) { return; }
    return (typeof(spec[property]) === "function") ? spec[property](M) : spec[property];
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
        if(!state) { throw new Error("No state specified"); }

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
                var hasPendingNotification = getPendingNotification(M, spec.name);
                var primaryText = M.getTextMaybe("transition:"+spec.transition) || "Notify: "+O.interpolateNAMEinString(spec.displayName);
                var defaultText = "Edit: "+O.interpolateNAMEinString(spec.displayName);
                var indicator = hasPendingNotification ? "standard" : (M.getTextMaybe("transition-indicator:"+spec.transition) || "primary");
                builder.link("default",
                    "/do/workflow-notifications/write/"+spec.name+"/"+M.workUnit.id,
                    hasPendingNotification ? defaultText : primaryText,
                    indicator);
            }
        });

        // Prevent transitions until a notification has been written
        workflow.filterTransition(SELECTOR, function(M, name) {
            if(spec.transition === name && !getPendingNotification(M, spec.name)) { return false; }
        });

        // Display the notification for review on the transition page
        workflow.transitionUI(SELECTOR, function(M, E, ui) {
            if(ui.requestedTransition !== spec.transition) { return; }
            var pending = getPendingNotification(M, spec.name);
            if(!pending) { return; }
            ui.addFormDeferred("top", P.template("review").deferredRender({
                M: M,
                notification: pending
            }));
        });

        // When transitioning, send the notification and mark it as not pending any more
        workflow.observeExit(SELECTOR, function(M, transition) {
            if(transition !== spec.transition) { return; }
            var pending = getPendingNotification(M, spec.name);
            if(pending) {
                // Send notification by email
                if(spec.sendEmail) {
                    var sendSpec = _.clone(getPropertyFromSpec(M, spec, "sendEmail"));
                    var sendView = {
                        displayName: O.interpolateNAMEinString(spec.displayName),
                        url: O.application.url + M.url,
                        subject: getPropertyFromSpec(M, spec, "subject"),
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
            if(spec.noRedirect) { return; }
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
        panel.link(100+index, "/do/workflow-notifications/view/"+spec.name+"/"+M.workUnit.id, O.interpolateNAMEinString(spec.displayName));
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
        displayName: O.interpolateNAMEinString(info.spec.displayName),
        M: M,
        form: form
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/workflow-notifications/view", [
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
        displayName: O.interpolateNAMEinString(info.spec.displayName),
        M: M,
        notifications: _.map(notifications, function(notification) {
            return _.extend(notification, { url: "/do/workflow-notifications/download/"+name+"/"+workUnit.id+"/"+notification.id });
        })
    });
});

P.respond("GET", "/do/workflow-notifications/download", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"workUnit", allUsers:true},
    {pathElement:2, as:"db", table:"notifications"}
], function(E, name, workUnit, notification) {
    var info = getWorkflowNotificationInfo(workUnit, name); // stops if not defined
    const permissionsCheck = workUnit.ref.load();
    const M = info.workflow.instance(workUnit);

    const notificationHTML = O.text(O.T_TEXT_DOCUMENT, notification.text);
    const letterHTML = P.template("notification-download").render({ html:notificationHTML });
    let pipeline = O.fileTransformPipeline();
    let letterhead, margin;
    const sender = notification.sentBy;
    letterhead = O.serviceMaybe("hres_file_templates:get_template:maybe", sender ? sender.ref : null, ["DEFAULT"]);
    if(letterhead) {
        pipeline.file("letterhead", letterhead.file);
        margin = letterhead.margin;
    }
    pipeline.transform("std:generate:formatted_text", _.extend({}, margin, {
        html: letterHTML,
        css: P.loadFile("notification.css").readAsString()
    }));
    if(letterhead) {
        pipeline.transformPreviousOutput("std:pdf:overlay", {
            overlay: "letterhead"
        });
    }
    let fileName = O.interpolateNAMEinString(info.spec.displayName)+".pdf";
    const object = M.entities.object;
    fileName = (object && object.title) ? object.title + "_" + fileName : fileName;
    fileName = fileName.replace(/ /g,"_");
    const redirectURL = pipeline.urlForOuputWaitThenDownload("output", fileName);
    pipeline.execute();
    E.response.redirect(redirectURL);
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

// Serialisation support
P.implementService("std:serialiser:discover-sources", function(source) {
    source({
        name: "haplo_workflow:editable_notifications",
        sort: 2000,
        depend: "std:workflow",
        setup(serialiser) {
            serialiser.listen("std:workflow:extend", function(workflowDefinition, M, work) {
                work.notifications = {};
                let id = M.workUnit.id;
                let rows = P.db.notifications.select().
                    where("workUnitId","=",M.workUnit.id);
                _.each(rows, (row) => {
                    work.notifications[row.name] = {
                        text: row.text,
                        pending: row.pending,
                        sentAt: serialiser.formatDate(row.sentAt)
                    };
                });
            });
        },
        apply(serialiser, object, serialised) {
        }
    });
});