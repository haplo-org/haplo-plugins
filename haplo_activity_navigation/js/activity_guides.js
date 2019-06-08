/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var USE_BUILT_IN_GUIDES = !(O.application.config["haplo_activity_navigation:disable_built_in_guides"]);

if(USE_BUILT_IN_GUIDES) {

    P.db.table("guides", {
        activity: {type:"text"},
        title: {type:"text"},
        sort: {type:"int"},
        user: {type:"user"},        // which user saved this
        latest: {type:"boolean"},   // whether this is the latest version
        replacesId: {type:"int", nullable:true},
        document: {type:"json"}
    });

    var guidesForActivity = function(activityName) {
        return P.db.guides.select().
            where("activity","=",activityName).
            where("latest","=",true).
            order("sort").order("title");
    };

    var checkedActivity = function(activityName) {
        var activity = P.getActivity(activityName);
        if(!activity || !O.currentUser.allowed(activity.editAction)) { O.stop("Not permitted"); }
        return activity;
    };

    // ----------------------------------------------------------------------

/*HaploDoc
node: /haplo_activity_navigation/blank_forms
title: Blank forms
sort: 1
--
h3(service). "haplo_activity_navigation:blank-forms:"+activityName

With this tool you can integrate sets of _blank_ @FormDescription@ objects into an activity in an attempt to provide HTML forms to users for information only.

Dynamic choices are pre-populated using dummy data, this dummy data can be overwitten using the application config with the key @haplo_activity_navigation:blank-forms:automatic_instance_choices@.

h4. Usage

In your plugin begin by registering a service like:

<pre>language=javascript
P.implementService("haplo_activity_navigation:blank-forms:graduate-school", function(forms) {
    forms({
        // ...
    });
}
</pre>

where the @serviceFunction@ takes a JavaScript function argument that you can use to pass the 'metadata' object which can consist of the following properties:

h3(property). name

*REQUIRED:* A unique string that identifies the set of @FormDescription@ objects that you want to declare.

h3(property). title

*REQUIRED:* A display string for the set of @FormDescription@ objects.

Note that use of @NAME()@ through string interpolation is supported.

h3(property). sort

A number which controls the order in which the sets of @FormDescription@ objects appear when available for selection in the UI.

h3(property). forms

*REQUIRED:* An array of @FormDescription@ objects forming the set you want to integrate into the activity.

h3(property). document

A JavaScript object that may be used for showing options from the set of @FormDescription@ objects.

The keys of this object should correspond to paths. The data contained by the object will operate the form.

In this service you can specify any number of @FormDescription@ object sets using the procedure detailed above.
*/
    var _blankFormsByActivity = {};
    var getBlankFormsForActivity = function(activityName) {
        var blankForms = _blankFormsByActivity[activityName];
        if(!blankForms) {
            var forms = [];
            O.serviceMaybe("haplo_activity_navigation:blank-forms:"+activityName, function(spec) {
                if(!spec)                           { throw new Error("must pass specification for blank forms"); }
                if(typeof(spec.name) !== "string")  { throw new Error("must have String 'name' property in specification for blank forms"); }
                if(typeof(spec.title) !== "string") { throw new Error("must have String 'title' property in specification for blank forms"); }
                if(!_.isArray(spec.forms))          { throw new Error("must have Array 'forms' property in specification for blank forms"); }
                spec.title = O.interpolateNAMEinString(spec.title);
                forms.push(spec);
            });
            blankForms = _.sortBy(forms, "sort");
            _blankFormsByActivity[activityName] = blankForms;
        }
        return blankForms;
    };

    // ----------------------------------------------------------------------

    var deferredRenderGuidesForActivity = function(activity) {
        var blankForms = getBlankFormsForActivity(activity.name);
        return P.template("guides/overview-guides").deferredRender({
            activity: activity,
            sections: _.map(guidesForActivity(activity.name), function(section) {
                var document = section.document;
                var forms = [];
                _.each(document.blankForms || [], function(f) {
                    var form = _.find(blankForms, function(bf) { return bf.name === f.formId; });
                    if(form) { forms.push({form:form, comment:f.comment}); }
                });
                return {
                    section: section,
                    document: document,
                    activity: activity,
                    guides: _.map(document.guides || [], function(f) {
                        return {
                            title: f.title,
                            screen: f.screen ? O.file(f.screen).url(SCREEN_LINK_OPTIONS) : undefined,
                            print: f.print   ? O.file(f.print).url(PRINT_LINK_OPTIONS)   : undefined
                        };
                    }),
                    forms: forms,
                    files: _.map(document.files || [], function(f) {
                        return {
                            title: f.title,
                            file: f.file ? O.file(f.file).url(SCREEN_LINK_OPTIONS) : undefined
                        };
                    })
                };
            }),
            canEdit: O.currentUser.allowed(activity.editAction)
        });
    };

    // ----------------------------------------------------------------------

    var SCREEN_LINK_OPTIONS = {authenticationSignature:true};
    var PRINT_LINK_OPTIONS =  {authenticationSignature:true, forceDownload:true};

    P.implementService("haplo_activity_navigation:overview", function(activity, add) {
        add(100, deferredRenderGuidesForActivity(activity));
    });

    // ----------------------------------------------------------------------

    P.respond("GET", "/do/activity/guides/edit-guides", [
        {pathElement:0, as:"string"}
    ], function(E, activityName) {
        var activity = checkedActivity(activityName);
        E.render({
            activity: activity,
            sections: guidesForActivity(activityName)
        }, "guides/list");
    });

    var EditForm = P.form("guides", "form/guides/edit-guides.json");

    P.respond("GET,POST", "/do/activity/guides/edit-guide-section", [
        {pathElement:0, as:"string"},
        {pathElement:1, as:"db", table:"guides", optional:true}
    ], function(E, activityName, existingRow) {
        var activity = checkedActivity(activityName);
        var document = existingRow ? existingRow.document : {};
        var form = EditForm.instance(document);
        form.choices("blankForms", getBlankFormsForActivity(activity.name));
        form.update(E.request);
        if(form.complete) {
            var row = P.db.guides.create({
                activity: activity.name,
                title: document.title,
                sort: 1000,
                user: O.currentUser,
                latest: true,
                document: document
            });
            if(existingRow) { row.replacesId = existingRow.id; }
            row.save();
            if(existingRow) {
                existingRow.latest = false;
                existingRow.save();
            }
            E.response.redirect("/do/activity/guides/edit-guides/"+activity.name);
        }
        E.render({
            activity: activity,
            row: existingRow,
            form: form
        }, "guides/edit-section");
    });

    // --------------------------------------------------------------------------

    P.respond("GET", "/do/activity/guides/all", [
    ], function(E) {
        var activityGuides = _.map(P.getActivities(), function(activity) {
            return {
                title: activity.title,
                deferred: deferredRenderGuidesForActivity(activity)
            };
        });
        if(activityGuides.length === 1) {
            // If there's only one activity in this application, the title
            // on the guides page would just add visual noise. Remove it.
            delete activityGuides[0].title;
        }
        E.render({activityGuides:activityGuides}, "guides/all");
    });

    P.hook('hNavigationPosition', function(response, name) {
        if(name === "haplo:activity-navigation:guides") {
            var navigation = response.navigation;
            navigation.separator();
            navigation.link("/do/activity/guides/all", "Guides");
        }
    });

    // --------------------------------------------------------------------------
    const DUMMY_CHOICES = O.application.config["haplo_activity_navigation:blank-forms:automatic_instance_choices"] ||
        ["Choice 1", "Choice 2... (dynamically populated)"];

    P.respond("GET,POST", "/do/activity/guides-blank-form", [
        {pathElement:0, as:"string"},
        {pathElement:1, as:"string"}
    ], function(E, activityName, blankFormName) {
        var activity = P.getActivity(activityName);
        var blankForms = getBlankFormsForActivity(activity.name);
        var form = _.find(blankForms, function(bf) { return bf.name === blankFormName; });
        if(!form) { return; }
        var forms = _.map(form.forms, function(f) {
            var formInstance = f.instance(form.document||{});

            var populateDynamicChoices = function(elements) {
                _.each(elements, function(element) {
                    if(element.type === "choice" && typeof element.choices === "string") {
                        formInstance.choices(element.choices, DUMMY_CHOICES);
                    } else if('elements' in element) {
                        //Search deeper, recursively, as some elements can contain a set of inner elements
                        //(which can also contain another set of inner elements, and so on and so forth...)
                        populateDynamicChoices(element.elements);
                    }        
                });
            };
            
            populateDynamicChoices(f.specification.elements);

            if(form.externalData) {
                formInstance.externalData(form.externalData);
            }

            return {
                form: f,
                instance: formInstance
            };
        });
        E.render({
            activity: activity,
            form: form,
            forms: forms
        }, "guides/blank-form");
    });

}
