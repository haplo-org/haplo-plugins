/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// This provider uses platform internal interfaces, but it's not a production plugin and checks things are as expected,
// so it should be OK.

var root = (function() { return this; })();

P.implementService("haplo:qa-audit:gather-information", function(audit) {
    // Plugins & forms
    var plugins = {};
    var formSpecifications = {};
    _.each(O.application.plugins.slice(0).sort(), function(pluginName) {
        var plugin = root[pluginName];
        if(plugin) {
            var formSpecs = formSpecifications[pluginName] = {},
                formIds = _.keys(plugin.$formLookupById || {}).sort();
            _.each(formIds, function(formId) {
                formSpecs[formId] = plugin.$formLookupById[formId].specification;
            });
            plugins[pluginName] = {
                pluginName: pluginName,
                isStandardPlugin: !!pluginName.match(/^std_/),
                services: [], // filled in later
                forms: formIds,
                workUnits: [], // filled in below
                requestHandlers: _.select(_.keys(plugin), function(prop) { return prop.match(/^[A-Z]+ \//); }).
                    map(function(k) { var x = k.split(' '); return {method:x[0], path:x[1]}; }).
                    sort()
            };
        }
    });
    audit.addInformation("formSpecifications", "Form specifications by plugin", formSpecifications);

    // Services
    if(!($registry && $registry.services)) {
        throw new Error("Expected platform internals not found");
    }
    var platformServices = $registry.services;
    var platformServiceNames = _.keys(platformServices).sort(); // so they're in a nice order
    var services = {};
    _.each(platformServiceNames, function(name) {
        var list = platformServices[name];
        var details = services[name] = {};
        list.forEach(function(i) {
            if(typeof(i[0]) !== "function") {
                throw new Error("Expected platform internals do not contain expected type of data: Function");
            }
            if(!(i[1] instanceof $Plugin)) {
                throw new Error("Expected platform internals do not contain expected type of data: Plugin");
            }
            var p = i[1].pluginName;
            details[p] = (p in details) ? (details[p]+1) : 1;
            if(p in plugins) { plugins[p].services.push(name); plugins[p].services.sort(); }
        });
    });
    audit.addInformation("services", "Services defined by plugins", services);

    // Add Work units to plugins and create own information
    if(!($registry && $registry.workUnits)) {
        throw new Error("Expected platform internals not found");
    }
    var platformWorkUnits = $registry.workUnits;
    var platformWorkUnitTypes = _.keys(platformWorkUnits).sort();
    var workUnits = {};
    _.each(platformWorkUnitTypes, function(workType) {
        var info = $registry.workUnits[workType];
        if(info) {
            workUnits[workType] = {
                workType: workType,
                workTypeUnqualified:info.unqualifiedType,
                implementedBy: info.plugin.pluginName
            };
            plugins[info.plugin.pluginName].workUnits.push(workType);
        }
    });
    audit.addInformation("workUnitTypes", "Types of WorkUnit defined by plugins", workUnits);

    // std_workflow
    var std_workflow = root.std_workflow;
    if(std_workflow) {
        if(!std_workflow.allWorkflows) {
            throw new Error("Expected std_workflow internals not found");
        }
        var stdWorkflowTypes = _.keys(std_workflow.allWorkflows).sort();
        var stdWorkflow = {};
        _.each(stdWorkflowTypes, function(workType) {
            var workflow = std_workflow.allWorkflows[workType];
            if(workflow) {
                stdWorkflow[workType] = {
                    workType: workType,
                    description: workflow.description,
                    implementedBy: workflow.plugin.pluginName,
                    states: workflow.$instanceClass.prototype.$states,
                    text: workflow.$instanceClass.prototype.$textLookup
                };
            }
        });
        audit.addInformation("std_workflow", "std_workflow definitions", stdWorkflow);
    }

    // Activities
    var haplo_activity_navigation = root.haplo_activity_navigation;
    if(haplo_activity_navigation) {
        var activities = {};
    }

    // Add the plugins summary at the end
    audit.addInformation("plugins", "Plugins", plugins);
});

// --------------------------------------------------------------------------

// Identify issues with use of std plugins
P.implementService("haplo:qa-audit:identify-issues", function(audit) {

    var services = audit.getInformation("services");

    // Use of global configuration for dashboards is dangerous and needs to be done carefully.
    var GLOBAL_DASHBOARD_CONFIG = /^std:reporting:collection_dashboard:.+?:setup(_export)?(_final)?$/;
    
    _.each(services, function(details, serviceName) {
        if(serviceName.match(GLOBAL_DASHBOARD_CONFIG) || (serviceName === 'std:reporting:dashboard:*:setup')) {
            _.each(details, function(count, plugin) {
                // When multiple implementations, have one issue for each
                for(var i = 0; i < count; ++i) {
                    audit.issue(
                        "dangerous-dashboard-service-implemented/"+plugin+"/"+serviceName+"/"+i,
                        "Global reporting dashboard setup is dangerous",
                        "1) You need to check the type of the dashboard, as different types implement different functions. Eg aggregate dashboards don't implement the column functions. Use the kind property on the dashboard object to check.\n"+
                        "2) Your configuration needs to work on every possible dashboard, customised or not. If this is in shared functionality, then it's got to work for all clients which use it, now and in the future.\n"+
                        plugin+" implements "+serviceName+" "+count+" times, and there is one issue per implementation.\n"+
                        "Check that you've carefully thought this through, and are checking the types of the dashboards in your service implementations. Then suppress the issue with an explanation."
                    );
                }
            });
        }
    });

    // ----------------------------------------------------------------------

    // Basic checks on forms
    var formSpecifications = audit.getInformation("formSpecifications");
    var checkFormElements = function(audit, pluginName, formId, elements) {
        if(!elements) { return; }
        for(var i = 0; i < elements.length; ++i) {
            var element = elements[i];
            // File repeating sections
            if(element.type === "file-repeating-section") {
                // Elements contains a path of .?
                if(undefined !== _.find(element.elements, function(e) { return e.path === '.'; })) {
                    if((element.allowAdd !== false) || (element.allowDelete !== false) ||
                        (element.elements.length !== 1) || (element.elements[0].type !== "file")) {
                        audit.issue(
                            "bad-simple-file-repeating-section/"+pluginName+"/"+formId+"/"+element.path,
                            "Simple file repeating section in form is not configured correctly",
                            "You've included a simple multiple file upload element in a form, but you didn't follow the guidance for best UX.\n"+
                            "Plugin: "+pluginName+", form: "+formId+", path: "+element.path+"\n"+
                            "To resolve, follow the example in the documentation: https://docs.haplo.org/dev/plugin/form/specification/file-repeating-section"
                        );
                    }
                }
            } else if(element.type === "boolean" && element.style === "confirm") {
                if(!("notConfirmedMessage" in element) || !("trueLabel" in element)) {
                    audit.issue(
                        "bad-simple-boolean-confirm/"+pluginName+"/"+formId+"/"+element.path,
                        "Simple boolean as confirm style in form is not configured correctly",
                        "You've included a simple confirmation box element in a form, but you didn't follow the guidance for best UX.\n"+
                        "Plugin: "+pluginName+", form: "+formId+", path: "+element.path+"\n"+
                        "To resolve, follow the example in the documentation: https://docs.haplo.org/dev/plugin/form/specification/boolean"
                    );
                }
            }
            // Recurse into sections
            checkFormElements(audit, pluginName, formId, element.elements);
        }
    };
    _.each(formSpecifications, function(forms, pluginName) {
        _.each(forms, function(specification, formId) {
            checkFormElements(audit, pluginName, formId, specification.elements);
        });
    });

    // ----------------------------------------------------------------------

    // Basic checks on workflows
    var stdWorkflow = audit.getInformation("std_workflow");
    _.each(stdWorkflow, function(workflow, workType) {
        if("timeline-entry" in workflow.text) {
            audit.issue(
                "workflow-text-defines-timeline-entry-without-transition/"+workType,
                "Workflow text defines 'timeline-entry' without a transition name.",
                "Without a transition name, this will break rendering of the timeline. Delete it, and add more specific timeline text for each transition.\n"+
                "Plugin: "+workflow.implementedBy
            );
        }
        var transitions = [];
        var transitionsUsedByStates = {};
        _.each(workflow.states, function(defn, state) {
            _.each(defn.transitions, function(t) {
                transitions.push(t[0]);
                if(!(t[0] in transitionsUsedByStates)) { transitionsUsedByStates[t[0]] = []; }
                transitionsUsedByStates[t[0]].push(state);
            });
        });
        _.each(_.uniq(transitions).sort(), function(t) {
            var noTextTimelineEntryTransitionUsedByStates = _.filter(transitionsUsedByStates[t], function(state) {
                return (!("timeline-entry:"+t in workflow.text) && !("timeline-entry:"+t+":"+state in workflow.text));
            });
            if(noTextTimelineEntryTransitionUsedByStates.length > 0) {
                if(!t.startsWith('_')) {
                    audit.issue(
                        "workflow-text-no-timeline-entry-for-transition/"+workType+'/'+t+'/'+noTextTimelineEntryTransitionUsedByStates.join(","),
                        "Workflow text should define 'timeline-entry:T' for all transitions.",
                        "Without a 'timeline-entry:"+t+"' defined in the workflow text, this transition will not be rendered in the user visible timeline.\n"+
                        'Define this text to resolve this issue: "timeline-entry:'+t+'": "",\n'+
                        "Note that transitions with names starting with _ are ignored by this check because they're assumed to be automatic transitions without user intervention.\n"+
                        "Plugin: "+workflow.implementedBy+", used in states "+noTextTimelineEntryTransitionUsedByStates.join(", ")
                    );
                }
            }
        });
    });

});
