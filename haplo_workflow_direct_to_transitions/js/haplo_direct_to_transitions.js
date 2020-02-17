/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.workflow.registerWorkflowFeature("haplo:directToTransitions", function(workflow, spec) {
    workflow.actionPanelTransitionUI(spec.selector || {}, function(M, builder) {
        let transitionList = M.transitions.list;
        if(spec.exclude) {
            _.each(spec.exclude, e => {
                if(!_.find(M.transitions.list, t => { return t.name === e; })) {
                    throw new Error("Unrecognised transition: "+e);
                }
            });
            transitionList = _.filter(M.transitions.list, t => {
                return !_.contains(spec.exclude, t.name);
            });
        }

        if(M.workUnit.isActionableBy(O.currentUser)) {
            _.each(transitionList, t => {
                builder.link("default",
                    "/do/workflow/transition/"+M.workUnit.id+"?transition="+t.name,
                    t.label, t.indicator);
            });
        }

        return true;
    });
});