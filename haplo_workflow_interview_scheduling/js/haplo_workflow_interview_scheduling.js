/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var workTypeMeetingDateDescsUsed = {};

var meetingDateForm = P.form({
    specificationVersion: 0,
    formId: "meetingDateForm",
    formTitle: "Meeting details",
    "class": "oforms-no-autofocus",
    elements: [
        {
            path: "date",
            label: "Date",
            required: true,
            type: "date"
        },
        {
            path: "time",
            label: "Time",
            type: "text",
            whitespace: "trim",
            validationRegExp: "^\\d\\d[:. ]\\d\\d$",
            validationFailureMessage: "Please enter the time as HH:MM",
            placeholder: "HH:MM",
            "class": "time-field"
        },
        {
            path: "location",
            label: "Location",
            whitespace: "trim"
        }
    ]
});

P.hook("hScheduleDailyEarly", function(response, year, month, dayOfMonth) {
    var hookCalledAt = new XDate(year, month, dayOfMonth).clearTime();
    _.each(O.work.query().tag("interviewScheduled", "t"), function(wu) {
        var object = wu.ref.load();
        var meetingDateDescs = workTypeMeetingDateDescsUsed[wu.workType];
        if(!meetingDateDescs) { return; }
        var everyMeetingDatePassedOrMissing = _.every(meetingDateDescs, function(descCode) {
            var meetingDateDesc = ATTR[descCode];
            var meetingDatetime = object.first(meetingDateDesc);
            if(!meetingDatetime) { return true; }    // TODO: reporting?
            var meetingStartDate = new XDate(meetingDatetime.start).clearTime();
            if(meetingStartDate <= hookCalledAt) {
                O.service("haplo_meeting_scheduling:meeting_date_passed", wu, SCHEMA.getAttributeInfo(meetingDateDesc));
                return true;
            }
            return false;
        });
        if(everyMeetingDatePassedOrMissing) {
            delete wu.tags.interviewScheduled;
            wu.save();
        }
    });
});

// For testing daily scheduled hook
P.respond("GET", "/do/haplo-workflow-interview-scheduling/test-scheduled", [
], function(E) {
    if(O.currentUser.isMemberOf(Group.Administrators)) {
        P.hScheduleDailyEarly({},0,0,0,0,0);
        E.response.body = "CALLED";
        E.response.kind = "text";
    }
});

var updateProjectDatesMaybe = function(spec, M, date, happened) {
    if(("projectDate" in spec) && O.serviceImplemented("hres:project_journal:dates")) {
        var dates = O.service("hres:project_journal:dates", M.entities.project_ref);
        var interviewDate = dates.date(spec.projectDate);
        interviewDate.nextOccurrence();     // May be a noop if actual date is undefined
        var setter;
        if(happened) {
            setter = "setActual";
        } else {
            setter = "setScheduled";
        }
        interviewDate[setter](new Date(date));
        dates.requestUpdatesThenCommitIfChanged({
            action: "haplo_meeting_scheduling:"+spec.projectDate+(happened ? ":passed" : ":scheduled")
        });
    }
};

var onSaveCompletedForm = function(spec, M, object, document) {
    var preventDefault = "onSaveCompletedForm" in spec ? spec.onSaveCompletedForm(spec, M, object, document) : false;
    if(preventDefault) { 
        // Cleanup
        return;
    }
    // To guard against invalid customFormsForKey
    if(!("date" in document)) { throw new Error("Meeting form must include 'date' in the document path."); }

    var mObject = object.mutableCopy();
    mObject.remove(spec.meetingDateDesc || A.MeetingDate);
    mObject.remove(spec.meetingLocationDesc || A.MeetingLocation);
    var date = new XDate(document.date);
    if(document.time) {
        var timeElements = _.map(document.time.split(/[:. ]/), function(i) { return parseInt(i,10); });
        date.setHours(Math.min(timeElements[0],23)).setMinutes(Math.min(timeElements[1],59));
    }
    var precision = document.time ? O.PRECISION_MINUTE : O.PRECISION_DAY;
    mObject.append(O.datetime(date.toDate(), undefined, precision), spec.meetingDateDesc || A.MeetingDate);
    if(document.location) {
        mObject.append(document.location, spec.meetingLocationDesc || A.MeetingLocation);
    }
    if(!mObject.valuesEqual(object)) {
        O.withoutPermissionEnforcement(function() {
            mObject.save();
        });
    }
    updateProjectDatesMaybe(spec, M, document.date);

    var meetingDay = date.clone().clearTime();
    if(!("isValidMeeting" in M.workUnit.tags)) { M.workUnit.tags.isValidMeeting = "v"; }
    if(meetingDay > new XDate().clearTime() || !M.transitions.has(spec.meetingTransition)) {
        M.workUnit.tags.interviewScheduled = "t";
        M.workUnit.save();
        if(spec.onScheduled) {
            spec.onScheduled(M, _.clone(document));
        }
    }
};

// TODO reconsider how this should work when returning to this state
P.workflow.registerWorkflowFeature("haplo:meeting_scheduling", function(workflow, spec) {
    var plugin = workflow.plugin,
        meetingDateDescs = workTypeMeetingDateDescsUsed[workflow.fullName],
        meetingDateDescInfo = SCHEMA.getAttributeInfo(spec.meetingDateDesc || A.MeetingDate);

    if(!meetingDateDescs) {
        workTypeMeetingDateDescsUsed[workflow.fullName] = [meetingDateDescInfo.code];
    } else if(-1 === meetingDateDescs.indexOf(meetingDateDescInfo.code)) {
        meetingDateDescs.push(meetingDateDescInfo.code);
    }

    workflow.use("std:document_store", {
        name: spec.documentStore.name,
        title: spec.documentStore.title || "Meeting arrangements",
        panel: spec.documentStore.panel || 150,
        priority: spec.documentStore.priority,
        path: spec.path+"/"+spec.documentStore.name,
        formsForKey: function(key) {
            if("customFormsForKey" in spec.documentStore) {
                return spec.documentStore.customFormsForKey(key);
            } else {
                return [meetingDateForm];
            }
        },
        prepareFormInstance: spec.documentStore.customPrepareFormInstance,
        blankDocumentForKey: spec.documentStore.customBlankDocumentForKey,
        updateDocumentBeforeEdit: spec.documentStore.customUpdateDocumentBeforeEdit,
        shouldEditForm: spec.documentStore.customShouldEditForm,
        shouldDisplayForm: spec.documentStore.customShouldDisplayForm,
        onCommit: spec.documentStore.customOnCommit,
        getAdditionalUIForViewer: spec.documentStore.customGetAdditionalUIForViewer,
        getAdditionalUIForEditor: spec.documentStore.customGetAdditionalUIForEditor,
        view: spec.documentStore.view,
        edit: spec.documentStore.edit,
        history: spec.documentStore.history || [], // defaults to no viewable history
        onSetCurrentDocument: function(instance, document, isComplete) {
            if(isComplete && (!instance.hasCommittedDocument || !_.isEqual(document, instance.lastCommittedDocument))) {
                onSaveCompletedForm(spec, instance.key, instance.key.workUnit.ref.load(), document);
                instance.commit();  // So we can reliably tell when a document changes on save
            }
        },
        onFinishPage: function(M) {
            var document = workflow.documentStore[spec.documentStore.name].instance(M).currentDocument;
            if(!document.date) {
                return M.url;
            }
            var date = new XDate(document.date);
            var meetingDay = date.clone().clearTime();
            if(meetingDay <= new XDate().clearTime() && M.transitions.has(spec.meetingTransition)) {
                return spec.path+"/"+spec.documentStore.name+"/confirm-date-in-past/"+M.workUnit.id;
            } else {
                return M.url;
            }
        }
    });

    plugin.implementService("haplo_meeting_scheduling:meeting_date_passed", function(workUnit, meetingDateInfo) {
        var matchDateDesc = true;
        if(meetingDateInfo) {
            var meetingDateDesc = spec.meetingDateDesc || A.MeetingDate;
            matchDateDesc = SCHEMA.getAttributeInfo(meetingDateDesc).code === meetingDateInfo.code;
        }
        if(workflow.fullName !== workUnit.workType || !matchDateDesc) { return; }
        var M = workflow.instance(workUnit);
        updateProjectDatesMaybe(spec, M, new Date(), true);
        if(M.transitions.has(spec.meetingTransition)) {
            M.transition(spec.meetingTransition);
        }
    });

    plugin.respond("GET,POST", spec.path+"/"+spec.documentStore.name+"/confirm-date-in-past", [
        {pathElement:0, as:"workUnit", allUsers: true}
    ], function(E, workUnit) {
        var M = workflow.instance(workUnit); 
        if(!M.transitions.has(spec.meetingTransition)) { O.stop("Invalid action"); }
        if(!O.serviceMaybe("std:document_store:workflow:form_action_allowed", M, spec.documentStore.name, O.currentUser, 'edit')) { O.stop("Not permitted"); }
        var document = workflow.documentStore[spec.documentStore.name].instance(M).currentDocument;
        var date = new XDate(document.date);
        var meetingDay = date.clone().clearTime(); 
        if(meetingDay > new XDate().clearTime()) { O.stop("Date is not past"); }
        if(E.request.method === "POST") {
            if("interviewScheduled" in M.workUnit.tags) {
                delete M.workUnit.tags.interviewScheduled;
                M.workUnit.save();
            }
            if(!("isValidMeeting" in M.workUnit.tags)) { M.workUnit.tags.isValidMeeting = "v"; }
            updateProjectDatesMaybe(spec, M, document.date, true);
            M.transition(spec.meetingTransition);
            E.response.redirect(M.url);
            return;
        }
        E.render({
            pageTitle: "Confirm date in past",
            backLink: spec.path+"/"+spec.documentStore.name+"/form/"+workUnit.id,
            text: "You have scheduled the meeting in the past. This will move on to the next stage of the process. Are you sure?",
            options:[{label:"Confirm"}]
        }, "std:ui:confirm");
    });

    P.implementService("haplo_meeting_scheduling:get_used_worktype_meeting_date_desc", function() {
        return workTypeMeetingDateDescsUsed;
    });

});
