/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var startOnlineDecisionForm = P.form({
    specificationVersion: 0,
    formId: "startOnlineDecisionForm",
    formTitle: "Starting the NAME(online decision) process",
    elements: [
        {
            // clientside javascript 'Select all' assumes that these are the only radio checkboxes
            // in the form - avoid adding further choice checkboxes to this form
            type: "choice",
            label: "Committee members to be invited:",
            path: "invited",
            style: "multiple",
            choices: "people",
            minimumCount: 1
        },
        {
            type: "paragraph",
            label: "Add a note:",
            path: "note"
        },
        {
            type: "date",
            label: "Enter the response deadline:",
            path: "deadline"
        }
    ]
});

var editParticipantsForm = P.form({
    specificationVersion: 0,
    formId: "editParticipantsForm",
    formTitle: "Edit the participant list for the NAME(online decision)",
    elements: [
        {
            type: "choice",
            label: "Invited committee members:",
            path: "invited",
            style: "multiple",
            choices: "people",
            minimumCount: 1
        }
    ]
});

var votingForm = P.form({
    specificationVersion: 0,
    formId: "votingForm",
    formTitle: "Voting in the NAME(online decision) process",
    elements: [
        {
            type: "choice",
            style: "radio",
            label: "Your recommendation",
            path: "vote",
            required: true,
            choices: "voteChoices"
        },
        {
            type: "paragraph",
            label: "Comments",
            path: "message"
        }
    ]
});

var messageForm = P.form({
    specificationVersion: 0,
    formId: "messageForm",
    formTitle: "Add comment",
    elements: [
        {
            type: "paragraph",
            label: "Message",
            required: true,
            path: "message"
        }
    ]
});

P.noCommitteeMembersFoundNotice = function(M, E) {
    var app = M.entities.object;
    E.render({
        pageTitle: "Start online decision process",
        backLink: app.url(),
        message: "No committee members found on committee record. "+
            "This feature requires committee members to function.",
        dismissLink: app.url(),
        dismissText: "OK"
    }, "std:ui:notice");
};

var sendNotificationEmail = function(M, recipient, template, title, app, view) {
    template = P.template(template);
    view = view || {};
    view.appTitle = app.title;
    view.appUrl =  O.application.url+app.url();
    title = title || NAME("Online Decision");
    view.emailSubject = view.title = title;
    if(recipient && recipient.id !== 0) {
        M.sendEmail({
            template: template,
            to: recipient,
            view: view
        });
    }
};

var getCommitteeMembersList = function(committee) {
    var people = [];
    var attrs = [A.CommitteeMember, A.Chair, A.DeputyChair];
    _.each(attrs, function(attr) {
        committee.every(attr, function(p) { people.push(p); });
    });
    return _.uniq(_.reduce(people, function(memo, p) {
        var person = p.load();
        var personUser = O.user(person.ref);
        if(personUser) { // only include those with a user account attached
            memo.push([person.ref.toString(), person.title]);
        }
        return memo;
    }, []), function(p) { return p[0]; });
};

P.showOnlineDecisionCreationLink = function(workflow, app) {
    var plugin = workflow.plugin;
    if("csOnlineDecision" in plugin.db) {
        var count = plugin.db.csOnlineDecision.select().
            where("object","=",app.ref).where("closed","=",null).count();
        return (count === 0);
    }
};

var getChoices = function(stateInfo, M) {
    return (typeof(stateInfo.onlineDecision.choices) === "function") ?
        stateInfo.onlineDecision.choices(M) :
        stateInfo.onlineDecision.choices;
};

P.makeOnlineDecisionHandlers = function(workflow, spec) {
    var plugin = workflow.plugin;


    plugin.db.table('csOnlineDecision', {
        committee: {type:"ref"},
        object: {type:"ref"},
        opened: {type:"datetime"},
        closed: {type:"datetime", nullable:true},
        deadline: {type:"datetime", nullable:true},
        state: {type:"text"},
        document: {type:"text"}
    });

    plugin.db.table('csDiscussion', {
        onlineDecision: {type:"link", linkedTable:"csOnlineDecision"},
        user: {type:"ref"},
        message: {type:"text", nullable:true},
        choice: {type:"text", nullable:true},
        datetime: {type:"datetime"},
        parent: {type:"int", nullable:true}
    });

    workflow.observeExit({flags:["scheduleWorkflowExit"]}, function(M, transition) {
        // when transitioning out of committee scheduling
        // delete all workUnit's for online decision phase
        var app = M.entities.object;
        var wus = O.work.query("haplo_workflow_committee_scheduling:online_decision").
            ref(app.ref);
        _.each(wus, function(wu) {
            wu.deleteObject();
        });
        // mark as closed in the db
        var onlineDecision = plugin.db.csOnlineDecision.select().
            where("object","=",app.ref).where("closed","=",null);
        if(onlineDecision.length) {
            onlineDecision[0].closed = new Date();
            onlineDecision[0].save();
        }
    });

    _.each(spec.scheduleInfo, function(stateInfo) {
        workflow.actionPanel({state:stateInfo.state}, function(M, builder) {
            var app = M.entities.object;
            var onlineDecision = plugin.db.csOnlineDecision.select().
                where("object","=",app.ref).where("closed","=",null);
            if(onlineDecision.length) {
                if(O.work.query("haplo_workflow_committee_scheduling:online_decision").
                        actionableBy(O.currentUser).tag("id", onlineDecision[0].id).latest() ||
                        M.workUnit.isActionableBy(O.currentUser)) {
                    builder.link(30, spec.path+"/online-decision/"+onlineDecision[0].id,
                        "Participate in "+NAME("online decision"), "primary");
                }
            }
        });
    });

    workflow.actionPanel({}, function(M, builder) {
        var app = M.entities.object;
        var onlineDecisions = plugin.db.csOnlineDecision.select().
            where("object","=",app.ref);
        var panel = builder.panel(250);
        _.each(onlineDecisions, function(od) {
            var committee = od.committee.load();
            // TODO: permissions, who can see online decisions
            if(committee.has(O.currentUser.ref)) {
                panel.link(od.id, spec.path+"/online-decision/"+od.id,
                    committee.title+" decision");
            }
        });
        if(!panel.empty) {
            panel.element(0, {title:NAME("Online decision")});
        }
    });

    plugin.respond("GET,POST", spec.path+"/start-online-decision", [
        {pathElement:0, as:"workUnit", workType:workflow.fullName}
    ], function(E, workUnit) {
        E.setResponsiblePlugin(P);
        var M = workflow.instance(workUnit);
        var app = M.entities.object;
        var stateInfo = _.find(spec.scheduleInfo, function(si) {
            return si.state === M.state;
        });
        if(!stateInfo) { O.stop("Invalid state"); }
        var committee = M.entities[stateInfo.committeeEntityName];
        if(!committee) { O.stop("Cannot find committee"); }
        var people = getCommitteeMembersList(committee);
        if(people.length === 0) {
            return P.noCommitteeMembersFoundNotice(M, E);
        }
        var document = {deadline: new XDate().addWeeks(1).toString("yyyy-MM-dd")};
        var form = startOnlineDecisionForm.instance(document);
        form.choices("people", people);
        form.update(E.request);
        if(E.request.method === "POST" && form.complete) {
            // prevent opening more than one at a time (eg: form resubmission)
            var onlineDecision = plugin.db.csOnlineDecision.select().
                where("object","=",app.ref).where("closed","=",null);
            if(onlineDecision.length) { O.stop("An "+NAME("online decision")+" process is already open."); }
            // start process and send workunits out
            var row = plugin.db.csOnlineDecision.create({
                committee: committee.ref,
                object: app.ref,
                opened: new Date(),
                closed: null,
                deadline: document.deadline ? new XDate(document.deadline) : null,
                state: stateInfo.state,
                document: JSON.stringify(document)
            });
            row.save();
            var decisionUrl = spec.path+"/online-decision/"+row.id;
            _.each(document.invited, function(p) {
                var user = O.user(O.ref(p));
                if(!user) { return; }
                var wu = O.work.create({
                    workType: "haplo_workflow_committee_scheduling:online_decision",
                    actionableBy: user,
                    ref: app.ref,
                    tags: {
                        id: row.id,
                        state: stateInfo.state
                    },
                    data: {url: decisionUrl}
                });
                wu.save();
                var view = {
                    decisionUrl: O.application.url+decisionUrl,
                    note: document.note,
                    deadline: document.deadline ? new XDate(document.deadline) : undefined
                };
                sendNotificationEmail(M, user, "email/online-decision-start",
                    "Online discussion "+app.title, app, view);
            });
            // hide the task from committee rep until deadline or all invites responded to
            if(document.deadline) {
                M.workUnit.openedAt = new XDate(document.deadline);
                M.workUnit.save();
            }
            return E.response.redirect(decisionUrl);
        }
        E.render({
            backLink: app.url(),
            committeeName: committee.title,
            committeeRef: committee.ref,
            instance: form
        }, "start-online-decision");
    });

    plugin.respond("GET", spec.path+"/online-decision", [
        {pathElement:0, as:"db", table:"csOnlineDecision"}
    ], function(E, onlineDecision) {
        E.setResponsiblePlugin(P);
        var app = onlineDecision.object.load();
        var isClosed = !!onlineDecision.closed;
        var M = workflow.instanceForRef(app.ref);
        var stateInfo = _.find(spec.scheduleInfo, function(si) {
            return si.state === onlineDecision.state;
        });
        if(!stateInfo) { O.stop("Invalid state"); }
        var committee = onlineDecision.committee.load();
        if(!committee) { O.stop("Cannot find committee"); }
        // TODO: permissions, who can see online decisions
        if(!committee.has(O.currentUser.ref)) { O.stop("Not permitted."); }
        var document = JSON.parse(onlineDecision.document);
        var invited = _.map(document.invited, function(invitee) {
            var inviteeRef = O.ref(invitee);
            if(inviteeRef) { 
                invitee = inviteeRef.load();
                return {title:invitee.title, url:invitee.url(), ref:inviteeRef};
            }
        });
        var messageRows = plugin.db.csDiscussion.select().
            where("onlineDecision","=",onlineDecision).order("datetime", true);
        var votesRows = _.uniq(_.filter(messageRows, function(entry) {
            return !!entry.choice;
        }), function(entry) {
            return entry.user.toString();
        });
        var counts = {};
        var choices = getChoices(stateInfo, M);
        _.each(choices, function(choice) {
            counts[choice[0]] = 0;
        });
        _.each(votesRows, function(row) {
            counts[row.choice]++;
        });
        var votes = _.map(choices, function(choice) {
            return {name: choice[0], title: choice[1], count: counts[choice[0]]};
        });
        messageRows = _.toArray(messageRows).reverse();
        // iterate through messages/choices and flag the ones that are a change of
        // recommendation so that we can show this in the UI
        var usersPreviousChoices = O.refdict();
        _.each(messageRows, function(row, index) {
            if(!row.choice) { return; }
            var previous = usersPreviousChoices.get(row.user);
            if(previous && previous !== row.choice) {
                messageRows[index].isChange = true;
            }
            usersPreviousChoices.set(row.user, row.choice);
        });
        var rootMessages = _.filter(messageRows, function(row) {
            return row.parent === null;
        });
        var choiceHash = _.object(choices);
        var messages = _.map(rootMessages, function(root) {
            return {
                unsafeid: root.id,
                text: root.message,
                date: root.datetime,
                choice: choiceHash[root.choice],
                isChange: root.isChange,
                user: root.user.load().title,
                replyUrl: spec.path+"/online-decision/add-comment/"+onlineDecision.id+"?parent="+root.id,
                children: _.reduce(messageRows, function(memo, row) {
                    if(row.parent === root.id) {
                        memo.push({
                            unsafeid: row.id,
                            text: row.message,
                            user: row.user.load().title,
                            date: row.datetime
                        });
                    }
                    return memo;
                }, []),
                isOpen: !onlineDecision.closed
            };
        });
        var addCommentUrl;
        if(!isClosed) { 
            var wu = O.work.query("haplo_workflow_committee_scheduling:online_decision").isEitherOpenOrClosed().
                actionableBy(O.currentUser).tag("id", onlineDecision.id).first();
            if(wu) {
                var elements = [
                    {href: spec.path+"/online-decision/vote/"+wu.id,
                        label: wu.closed ? "Change recommendation" : "Submit recommendation",
                        indicator: "primary"}
                ];
                if(!wu.closed) {
                    elements.push({
                        href: spec.path+"/online-decision/decline/"+wu.id,
                        label: "Decline invitation",
                        indicator: "terminal"
                    });
                }
                E.renderIntoSidebar({
                    elements: elements
                }, "std:ui:panel");
            }
            addCommentUrl = spec.path+"/online-decision/add-comment/"+onlineDecision.id;
            E.renderIntoSidebar({
                elements: [
                    {href: addCommentUrl,
                        label: "Add comment"}
                ]
            }, "std:ui:panel");
            if(M.workUnit.isActionableBy(O.currentUser)) {
                E.renderIntoSidebar({
                    elements: [
                        {href: spec.path+"/online-decision/edit-participants/"+onlineDecision.id,
                            label: "Edit participants", indicator: "secondary"},
                        {href: spec.path+"/online-decision/close/"+onlineDecision.id, 
                            label: "Close "+NAME("online decision"), indicator: "terminal"}
                    ]
                }, "std:ui:panel");
            }
        }
        var inviteePanel = O.ui.panel();
        inviteePanel.element(0, {title: "Invited"});
        _.each(invited, function(invitee) {
            var title = invitee.title;
            if(_.contains(document.declined, invitee.ref.toString())) {
                title += " (Declined)"; 
            }
            inviteePanel.relatedInfo("default", undefined, title);
        });
        E.appendSidebarHTML(inviteePanel.render());
        var datesPanel = O.ui.panel();
        datesPanel.relatedInfo("default", undefined,
            new XDate(onlineDecision.opened).toString("dd MMM yyyy"), "Opened");
        // not using db row deadline for legacy reasons - could be migrated
        if(document.deadline) {
            datesPanel.relatedInfo("default", undefined,
                new XDate(document.deadline).toString("dd MMM yyyy"), "Deadline");
        }
        if(isClosed) {
            datesPanel.relatedInfo("default", undefined, 
                new XDate(onlineDecision.closed).toString("dd MMM yyyy"), "Closed");
        }
        E.appendSidebarHTML(datesPanel.render());
        E.render({
            app: app,
            backLink: app.url(),
            backLinkText: "Application",
            breakdownUrl: spec.path+"/online-decision/voting-breakdown/"+onlineDecision.id,
            addCommentUrl: addCommentUrl,
            votes: votes,
            messages: messages
        }, "online-decision");
    });

    plugin.respond("GET,POST", spec.path+"/online-decision/edit-participants", [
        {pathElement:0, as:"db", table:"csOnlineDecision"}
    ], function(E, onlineDecision) {
        E.setResponsiblePlugin(P);
        var app = onlineDecision.object.load();
        var M = workflow.instanceForRef(app.ref);
        if(!M.workUnit.isActionableBy(O.currentUser)) { O.stop("Not permitted."); }
        var decisionUrl = spec.path+"/online-decision/"+onlineDecision.id;
        var committee = onlineDecision.committee.load();
        var people = getCommitteeMembersList(committee);
        var previousDocument = JSON.parse(onlineDecision.document);
        var document = {
            invited: _.map(previousDocument.invited, function(p) { return p; })
        };
        var form = editParticipantsForm.instance(document);
        form.choices("people", people);
        form.update(E.request);
        if(E.request.method === "POST" && form.complete) {
            // figure out who got removed and delete their workunits
            // TODO: do we nullify their votes? delete votes?
            var removed = _.difference(previousDocument.invited, document.invited);
            _.each(removed, function(p) {
                var user = O.user(O.ref(p));
                if(!user) { return; }
                var wus = O.work.query("haplo_workflow_committee_scheduling:online_decision").
                    isEitherOpenOrClosed(). // may have already voted
                    actionableBy(user).tag("id", onlineDecision.id);
                _.each(wus, function(wu) {
                    wu.deleteObject();
                });
            });
            // reverse difference tells us who was added
            var added = _.difference(document.invited, previousDocument.invited);
            _.each(added, function(p) {
                var userRef = O.ref(p);
                var user = O.user(userRef);
                if(!user) { return; }
                // check there isn't an existing workunit before we make one
                var q = O.work.query("haplo_workflow_committee_scheduling:online_decision").
                    actionableBy(user).tag("id", onlineDecision.id);
                // check that they haven't voted before. don't need to do workunit/notification if they have
                var messageRows = plugin.db.csDiscussion.select().
                    where("onlineDecision","=",onlineDecision).order("datetime", true);
                var currentUserVote = _.find(_.filter(messageRows, function(entry) {
                    return !!entry.choice;
                }), function(entry) {
                    return entry.user == userRef;
                });
                if(q.count() === 0 && !currentUserVote) {
                    // tell user about invitation with task and email
                    var wu = O.work.create({
                        workType: "haplo_workflow_committee_scheduling:online_decision",
                        actionableBy: user,
                        ref: app.ref,
                        tags: {
                            id: onlineDecision.id,
                            state: onlineDecision.state
                        },
                        data: {url: decisionUrl}
                    });
                    wu.save();
                    var view = {
                        decisionUrl: O.application.url+decisionUrl,
                        note: previousDocument.note,
                        deadline: previousDocument.deadline ? new XDate(previousDocument.deadline) : undefined
                    };
                    sendNotificationEmail(M, user, "email/online-decision-start",
                        "Invitation to discuss "+app.title, app, view);
                }
            });
            // update document in onlineDecision db row
            previousDocument.invited = document.invited;
            onlineDecision.document = JSON.stringify(previousDocument);
            onlineDecision.save();
            return E.response.redirect(decisionUrl);
        }
        E.render({
            backLink: decisionUrl,
            instance: form
        }, "online-decision-edit-participants");
    });

    plugin.respond("GET,POST", spec.path+"/online-decision/close", [
        {pathElement:0, as:"db", table:"csOnlineDecision"}
    ], function(E, onlineDecision) {
        E.setResponsiblePlugin(P);
        var app = onlineDecision.object.load();
        var M = workflow.instanceForRef(app.ref);
        if(!M.workUnit.isActionableBy(O.currentUser)) { O.stop("Not permitted."); }
        if(E.request.method === "POST") {
            // delete all workUnit's for online decision phase
            var wus = O.work.query("haplo_workflow_committee_scheduling:online_decision").
                ref(app.ref);
            _.each(wus, function(wu) {
                wu.deleteObject();
            });
            // mark closed in db
            onlineDecision.closed = new Date();
            onlineDecision.save();
            // make task visible again
            M.workUnit.openedAt = new Date();
            M.workUnit.save();
            return E.response.redirect(app.url());
        }
        E.render({
            pageTitle: "Close "+NAME("online decision")+" process",
            backLink: spec.path+"/online-decision/"+onlineDecision.id,
            text: "Would you like to close the "+NAME("online decision")+" process, "+
                "preventing any more votes and/or comments to be made?",
            options: [
                {
                    label: "Close the "+NAME("online decision")+" process"
                }
            ]
        }, "std:ui:confirm");
    });

    plugin.respond("GET,POST", spec.path+"/online-decision/decline", [
        {pathElement:0, as:"workUnit", workType:"haplo_workflow_committee_scheduling:online_decision"}
    ], function(E, workUnit) {
        E.setResponsiblePlugin(P);
        var onlineDecision = plugin.db.csOnlineDecision.load(workUnit.tags.id);
        var app = onlineDecision.object.load();
        var stateInfo = _.find(spec.scheduleInfo, function(si) {
            return si.state === onlineDecision.state;
        });
        if(!stateInfo) { O.stop("Invalid state"); }
        if(E.request.method === "POST") {
            var wu = O.work.query("haplo_workflow_committee_scheduling:online_decision").isOpen().
                actionableBy(O.currentUser).tag("id", onlineDecision.id).first(); 
            if(wu) {
                var document = JSON.parse(onlineDecision.document);
                var declined = document.declined || [];
                declined.push(wu.actionableBy.ref.toString());
                document.declined = declined;
                onlineDecision.document = JSON.stringify(document);
                onlineDecision.save();
                wu.deleteObject();
                // rep may want to know if someone has declined to participate
                var M = workflow.instanceForRef(app.ref);
                var committeeRepRef = M.entities[stateInfo.committeeEntityName+"Rep_refMaybe"];
                if(committeeRepRef) {
                    var committeeRepUser = O.user(committeeRepRef);
                    var researcher = wu.actionableBy.ref.load();
                    var view = {
                        researcher: researcher,
                        decisionUrl: O.application.url+spec.path+"/online-decision"/+onlineDecision.id
                    };
                    sendNotificationEmail(M, committeeRepUser, "email/online-decision-declined",
                       NAME("Online decision")+" invitation declined ("+app.title+")", app, view);
                }
                return E.response.redirect(app.url());
            }
        }
        E.render({
            pageTitle: "Decline invitation",
            backLink: spec.path+"/online-decision/"+onlineDecision.id,
            text: "Are you sure you would like to decline your invitation to participate in "+NAME("online decision")+"?"+
                " You will no longer be able to submit a recommendation.",
            options: [
                {
                    label: "Decline invitation"
                }
            ]
        }, "std:ui:confirm");
    });

    plugin.respond("GET,POST", spec.path+"/online-decision/voting-breakdown", [
        {pathElement:0, as:"db", table:"csOnlineDecision"}
    ], function(E, onlineDecision) {
        E.setResponsiblePlugin(P);
        var app = onlineDecision.object.load();
        var M = workflow.instanceForRef(app.ref);
        var stateInfo = _.find(spec.scheduleInfo, function(si) {
            return si.state === onlineDecision.state;
        });
        if(!stateInfo) { O.stop("Invalid state"); }
        var committee = onlineDecision.committee.load();
        if(!committee) { O.stop("Cannot find committee"); }
        // TODO: permissions, who can see online decisions
        if(!committee.has(O.currentUser.ref)) { O.stop("Not permitted."); }
        var allVotes = plugin.db.csDiscussion.select().where("choice","!=",null).
            where("onlineDecision","=",onlineDecision).order("datetime", true);
        var latestVotes = _.uniq(allVotes, function(entry) {
            return entry.user.toString();
        });
        var choices = getChoices(stateInfo, M);
        var choiceHash = _.object(choices);
        var document = JSON.parse(onlineDecision.document);
        var votes = _.map(_.filter(document.invited, function(refStr) {
            return !_.contains(document.declined, refStr);
        }), function(refStr) {
            var invitee = O.ref(refStr).load();
            var userVote = _.find(latestVotes, function(vote) {
                return vote.user.toString() === refStr;
            });
            var choiceName = userVote ? choiceHash[userVote.choice] : "choice not yet entered";
            return {ref: invitee.ref, title: invitee.title, voted: !!userVote, choice: choiceName};
        });
        E.render({
            app: app,
            backLink: spec.path+"/online-decision/"+onlineDecision.id,
            votes: votes
        }, "online-decision-breakdown");
    });

    plugin.respond("GET,POST", spec.path+"/online-decision/vote", [
        {pathElement:0, as:"workUnit", workType:"haplo_workflow_committee_scheduling:online_decision"}
    ], function(E, workUnit) {
        E.setResponsiblePlugin(P);
        var onlineDecision = plugin.db.csOnlineDecision.load(workUnit.tags.id);
        var app = onlineDecision.object.load();
        var M = workflow.instanceForRef(app.ref);
        var stateInfo = _.find(spec.scheduleInfo, function(si) {
            return si.state === onlineDecision.state;
        });
        if(!stateInfo) { O.stop("Invalid state"); }
        var vote = plugin.db.csDiscussion.select().where("onlineDecision","=",onlineDecision).
            where("user","=",workUnit.actionableBy.ref).
            where("choice","!=",null).order("datetime", true).limit(1);
        var document = vote.length ? {vote: vote[0].choice} : {};
        var form = votingForm.instance(document);
        var choices = getChoices(stateInfo, M);
        form.choices("voteChoices", choices);
        form.update(E.request);
        var datetime = new Date();
        var decisionUrl = spec.path+"/online-decision/"+onlineDecision.id;
        if(E.request.method === "POST" && form.complete) {
            var odDocument = JSON.parse(onlineDecision.document);
            var participants = _.map(_.filter(odDocument.invited, function(invitee) {
                return !_.contains(odDocument.declined, invitee);
            }), function(invitee) {
                var inviteeRef = O.ref(invitee);
                return inviteeRef;
            });
            var currentUserTitle = O.currentUser.ref ? O.currentUser.ref.load().title : "Unknown";
            // check here to see if we've got a vote from every participant
            var allVotes = plugin.db.csDiscussion.select().where("choice","!=",null).
                where("onlineDecision","=",onlineDecision).order("datetime", true);
            var latestVotes = _.uniq(allVotes, function(entry) {
                return entry.user.toString();
            });
            var userAlreadyVoted = _.any(latestVotes, function(entry) { return entry.user == O.currentUser.ref; });
            if(!userAlreadyVoted && latestVotes.length+1 >= participants.length) {
                var view = {
                    decisionUrl: O.application.url+decisionUrl
                };
                var committeeRepRef = M.entities[stateInfo.committeeEntityName+"Rep_refMaybe"];
                if(committeeRepRef) {
                    var committeeRepUser = O.user(committeeRepRef);
                    sendNotificationEmail(M, committeeRepUser, "email/online-decision-all-submitted",
                        "All recommendations submitted for "+app.title, app, view);
                }
                // make task visible to rep again
                M.workUnit.openedAt = new Date();
                M.workUnit.save();
            }
            // record the vote and notify other users/etc
            var voteRow = plugin.db.csDiscussion.create({
                onlineDecision: onlineDecision,
                user: O.currentUser.ref,
                datetime: datetime,
                choice: document.vote,
                message: document.message ? document.message : null
            });
            voteRow.save();
            workUnit.close(O.currentUser);
            workUnit.save();
            var choiceHash = _.object(choices);
            _.each(participants, function(inviteeRef) {
                if(O.currentUser.ref == inviteeRef) { return; }
                var user = O.user(inviteeRef);
                var view = {
                    decisionUrl: O.application.url+decisionUrl,
                    message: {
                        date: datetime,
                        user: currentUserTitle,
                        choice: choiceHash[document.vote],
                        text: document.message
                    }
                };
                sendNotificationEmail(M, user, "email/online-decision-new-vote",
                    "New recommendation submitted for "+app.title, app, view);
            });
            return E.response.redirect(decisionUrl+"#"+voteRow.id);
        }
        E.render({
            backLink: decisionUrl,
            instance: form
        }, "online-decision-vote");
    });

    plugin.respond("GET,POST", spec.path+"/online-decision/add-comment", [
        {pathElement:0, as:"db", table:"csOnlineDecision"},
        {parameter:"parent", as:"int", optional:true}
    ], function(E, onlineDecision, parent) {
        E.setResponsiblePlugin(P);
        if(onlineDecision.closed) { O.stop("Can't add a comment to a closed discussion"); }
        var workUnit = O.work.query().actionableBy(O.currentUser).tag("id", onlineDecision.id).first();
        var app = onlineDecision.object.load();
        var M = workflow.instanceForRef(app.ref);
        var stateInfo = _.find(spec.scheduleInfo, function(si) {
            return si.state === onlineDecision.state;
        });
        if(!stateInfo) { O.stop("Invalid state"); }
        var committee = onlineDecision.committee.load();
        if(!committee) { O.stop("Cannot find committee"); }
        // TODO: permissions, who can see online decisions
        if(!committee.has(O.currentUser.ref)) { O.stop("Not permitted."); }
        var document = {};
        var form = messageForm.instance(document);
        var messages, messageReplies, messageRoot, choiceHash;
        if(parent) {
            messageReplies = plugin.db.csDiscussion.select().where("parent","=",parent).order("datetime");
            messageRoot = plugin.db.csDiscussion.load(parent);
            choiceHash = _.object(getChoices(stateInfo, M));
            messages = {
                text: messageRoot.message,
                date: messageRoot.datetime,
                choice: choiceHash[messageRoot.choice],
                userRef: messageRoot.user,
                user: messageRoot.user.load().title,
                children: _.reduce(messageReplies, function(memo, row) {
                    if(row.parent === messageRoot.id) {
                        memo.push({text: row.message, userRef: messageRoot.user, user: row.user.load().title,
                            date: row.datetime});
                    }
                    return memo;
                }, [])
            };
        }
        form.update(E.request);
        var decisionUrl = spec.path+"/online-decision/"+onlineDecision.id;
        if(E.request.method === "POST" && form.complete) {
            var messageRow = plugin.db.csDiscussion.create({
                onlineDecision: onlineDecision,
                user: O.currentUser.ref,
                message: document.message,
                datetime: new Date(),
                parent: parent
            });
            messageRow.save();
            var currentUserTitle = O.currentUser.ref ? O.currentUser.ref.load().title : "Unknown";
            if(parent) {
                messages.children.push({text: document.message, userRef: O.currentUser.ref, user: currentUserTitle,
                    date: new Date()});
                var users = _.map(messageReplies, function(message) {
                    return message.user;
                });
                users.push(messageRoot.user);
                users = _.uniq(users, function(userRef) {
                    return userRef.toString();
                });
                _.each(users, function(userRef) {
                    if(O.currentUser.ref == userRef) { return; }
                    var user = O.user(userRef);
                    var view = {
                        decisionUrl: O.application.url+decisionUrl,
                        thread: messages
                    };
                    sendNotificationEmail(M, user, "email/online-decision-replied",
                        "Reply to a thread you participated in: "+app.title, app, view);
                });
            } else {
                var odDocument = JSON.parse(onlineDecision.document);
                var invited = _.map(_.filter(odDocument.invited, function(invitee) {
                    return !_.contains(odDocument.declined, invitee);
                }), function(invitee) {
                    var inviteeRef = O.ref(invitee);
                    return inviteeRef;
                });
                _.each(invited, function(inviteeRef) {
                    if(O.currentUser.ref == inviteeRef) { return; }
                    var user = O.user(inviteeRef);
                    var view = {
                        decisionUrl: O.application.url+decisionUrl,
                        message: {
                            date: new Date(),
                            user: currentUserTitle,
                            text: document.message
                        }
                    };
                    sendNotificationEmail(M, user, "email/online-decision-new-vote",
                        "New comment submitted for "+app.title, app, view);
                });
            }
            return E.response.redirect(decisionUrl+"#"+messageRow.id);
        }
        E.render({
            backLink: decisionUrl,
            thread: messages,
            instance: form
        }, "online-decision-comment");
    });
};

P.workUnit({
    workType: "online_decision",
    description: "Committee online decision task",
    render: function(W) {
        if(W.context === "object") { return; }
        var onlineDecisionId = W.workUnit.tags.id;
        var appRef = W.workUnit.ref;
        var app = appRef.load();
        var url = W.workUnit.data.url;
        W.render({
            appTitle: app.title,
            fullInfo: url,
            fullInfoText: "Submit recommendation..."
        }, "workunit_online_decision");
    }
});
