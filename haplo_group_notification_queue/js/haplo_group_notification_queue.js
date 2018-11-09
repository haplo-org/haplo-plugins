/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*
    Haplo Group Notification Queue Plugin
    
    Add simple tasks to system-wide queues that are assigned to a particular group.
    Members of the group have a central page where all outstanding/done tasks are listed,
    with any queue with outstanding tasks having an open work unit associated with said queue.

    O.service("haplo:group_notification_queue:task_definition:TASK_TYPE")
        with args
            ref - ref of the object linked to the task
        should return an object with properties:
            description - description of the task itself

    O.service("haplo:group_notification_queue:push", spec);
        where spec has properties:
            group - group for which queue the task is added to
            type - type of the task (must be defined using service above)
            ref - ref to specify the source of the task to allow link back
        and optional properties:
            deduplicateOnRef - if truthy, don't create a new task if there is
                an open task with the same group, type and ref.

    O.service("haplo:group_notification_queue:queue_definition:GROUP_ID")
        (where GROUP_ID is the id property of the group object)
        should return an object with properties:
            pageTitle - defines a custom page title for the queue
            workUnitTitle - defines a custom title for queue work units
            workUnitMessage - defines a custom message for queue work units

    O.service("haplo:group_notification_queue:url:action_page", GROUP_API_CODE)
        will return a link to the queue for a given group,
        if no outstanding tasks, link will direct to completed.

*/

// --------------------------------------------------------------------------
// Tables

P.db.table("gnQueuedTasks", {
    group: {type:"int", indexed:true},          // group ID for queue
    task: {type:"text"},                        // type of task
    ref: {type:"ref"},                          // associated ref
    created: {type:"datetime"},                 // when it was created
    done: {type:"datetime", nullable:true},     // when it was done
    doneBy: {type:"user", nullable:true}        // who it was done by
});

var selectQueuedTasks = function(group) {
    return P.db.gnQueuedTasks.select().where("group", "=", group);
};

// --------------------------------------------------------------------------
// Queries

var currentTasks = function(group) {
    var minutesAgo = 5;
    var recentTime = new XDate().addMinutes(-minutesAgo);
    return selectQueuedTasks(group).
        or(function(sq) {
            sq.where("done", "=", null).
                and(function(sqq) {
                    sqq.where("done", "!=", null).
                        where("done", ">=", recentTime);
                });
        }).
        order("created", true);
};

var remainingTasks = function(group) {
    return selectQueuedTasks(group).
        where("done", "=", null).
        order("created", true);
};

var completedTasks = function(group) {
    return selectQueuedTasks(group).
        where("done", "!=", null).
        order("created", true);
};

// --------------------------------------------------------------------------
// Work Units

var newWorkUnit = function(group) {
    return O.work.create({
        workType: "haplo_group_notification_queue:queue",
        actionableBy: O.group(group)
    }).save();
};

var currentWorkUnit = function(group) {
    return O.work.query("haplo_group_notification_queue:queue").
        actionableBy(O.group(group)).
        latest();
};

var updateWorkUnitForQueue = function(group) {
    // create/delete work units based on remaining tasks
    if(remainingTasks(group).count()) {
        if(!currentWorkUnit(group)) { newWorkUnit(group); }
    } else {
        currentWorkUnit(group).deleteObject();
    }
};

P.workUnit({
    workType: "queue",
    render: function(W) {
        var group = W.workUnit.actionableBy.id;
        var count = remainingTasks(group).count();
        var url = O.application.url+ 
            "/do/haplo-group-notification-queue/outstanding/"+group;
        var text = P.getCustomViewText(group);
        W.render({
            fullInfo: url,
            title: text.workUnitTitle,
            message: text.workUnitMessage
        }, "notification");
    }
});

// --------------------------------------------------------------------------
// Services

P.implementService("haplo:group_notification_queue:push", function(spec) {
    if(!O.serviceImplemented("haplo:group_notification_queue:task_definition:"+spec.type)) {
        throw new Error("No definition found for task of type: "+spec.type);
    }
    if(spec.deduplicateOnRef) {
        var deduplicateQuery = P.db.gnQueuedTasks.select().
            where("group", "=", spec.group).
            where("task",  "=", spec.type).
            where("ref",   "=", spec.ref).
            where("done",  "=", null);
        if(0 < deduplicateQuery.count()) {
            return;
        }
    }
    P.db.gnQueuedTasks.create({
        ref: spec.ref,
        group: spec.group,
        task: spec.type,
        created: new Date()
    }).save();
    updateWorkUnitForQueue(spec.group);
});

P.implementService("haplo:group_notification_queue:url:action_page", function(group) {
    var status = currentWorkUnit(group) ? "outstanding" : "completed";
    return "/do/haplo-group-notification-queue/"+status+"/"+group;
});

P.getCustomViewText = function(group) {
    var count = remainingTasks(group).count();
    var text = O.serviceMaybe("haplo:group_notification_queue:queue_definition:"+
        group, count) || {};
    if(!text.pageTitle) { text.pageTitle = "Updates ("+O.group(group).name+")"; }
    if(!text.workUnitTitle) { text.workUnitTitle = "Outstanding updates to complete"; }
    if(!text.workUnitMessage) { text.workUnitMessage = count+" update(s) to complete."; }
    return text;
};

// --------------------------------------------------------------------------
// Handlers

var generateTabs = function(page, group) {
    return [
        {
            href: "/do/haplo-group-notification-queue/outstanding/"+group,
            label: "Outstanding",
            selected: page === "outstanding"
        },
        {
            href: "/do/haplo-group-notification-queue/completed/"+group,
            label: "Completed",
            selected: page === "completed"
        }
    ];
};

var renderDefinitions = function(query) {
    return _.map(query, function(row) {
        var def = O.serviceMaybe("haplo:group_notification_queue:task_definition:"+row.task,
            row.ref);
        return def ? _.extend(row, def) : row;
    });
};

P.respond("GET", "/do/haplo-group-notification-queue/outstanding", [
    {pathElement:0, as:"int"}
], function(E, group) {
    if(!O.currentUser.isMemberOf(group)) { O.stop("Not permitted."); }
    E.render({
        pageTitle: P.getCustomViewText(group).pageTitle,
        tabs: generateTabs("outstanding", group),
        ui: P.template("table").deferredRender({
            group: group,
            name: O.group(group).name,
            tasks: renderDefinitions(currentTasks(group))
        })
    }, "view");
});

P.respond("GET", "/do/haplo-group-notification-queue/completed", [
    {pathElement:0, as:"int"}
], function(E, group) {
    if(!O.currentUser.isMemberOf(group)) { O.stop("Not permitted."); }
    E.render({
        pageTitle: P.getCustomViewText(group).pageTitle,
        tabs: generateTabs("completed", group),
        ui: P.template("table").deferredRender({
            group: group,
            name: O.group(group).name,
            tasks: renderDefinitions(completedTasks(group))
        })
    }, "view");
});

P.respond("GET,POST", "/do/haplo-group-notification-queue/task", [
    {pathElement:0, as:"db", table:"gnQueuedTasks"},
    {parameter:"group", as:"int"},
    {parameter:"action", as:"string"}
], function(E, row, group, action) {
    if(!O.currentUser.isMemberOf(group)) { O.stop("Not permitted."); }
    if(E.request.method === "POST") {
        var done = (row.done !== null);
        if(!done && action === "done") {
            row.done = new Date();
            row.doneBy = O.currentUser;
        } else if(done && action === "undo") {
            row.done = null;
            row.doneBy = null;
        }
        row.save();
        updateWorkUnitForQueue(group);
        E.response.redirect("/do/haplo-group-notification-queue/outstanding/"+group);
    }
});
