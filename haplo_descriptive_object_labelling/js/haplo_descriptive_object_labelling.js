/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// TODO: Consider whether it's worth updating labels when parents of objects change? (Should never really happen.)

var typeIsSelfLabelling,
    typeIsWorkflowIntegrated,
    typeLabelWithCreator,
    typeLabels,
    typeLabelWith,
    typeLabelsFromLinked,
    updateLinkedForType;

// --------------------------------------------------------------------------

P.implementService("std:workflow:notify:permissions:permissions_changed_for_object", function(objRef) {
    ensureSetup();
    // Recompute labels, in case read permissions due to workflow have changed
    var object = objRef.load();
    var types = object.everyType();
    if(_.find(types, function(type) {
        if(typeIsWorkflowIntegrated.get(type)) {
            return true;
        }})) {
        O.impersonating(O.SYSTEM, function() {
            var changes = O.labelChanges();
            replaceLabels(changes, object);
            object.relabel(changes);
        });
    }
});

var ensureSetup = function() {
    var rd = function() { return O.refdictHierarchical(function() { return []; }); };
    var staticLabels =    rd();
    var lists = {
        labels:           rd(),
        labelWith:        rd(),
        labelsFromLinked: rd()
    };
    updateLinkedForType = rd();
    typeIsSelfLabelling = O.refdictHierarchical();
    typeIsWorkflowIntegrated = O.refdictHierarchical();
    typeLabelWithCreator = O.refdictHierarchical();

    var applyList = function(type, rules, name, isTwoLevel) {
        var list = rules[name];
        if(list === undefined) { return; }
        if(!Array.isArray(list)) {
            throw new Error("Property "+name+" in rules must be an array");
        }
        if(isTwoLevel) {
            _.each(list, function(elem) {
                if(!Array.isArray(elem)) {
                    throw new Error("Property "+name+" in rules must be an array of arrays");
                }
                // TODO: Make this "at least 2" when we go to full attribute paths
                if(elem.length != 2) {
                    throw new Error("Property "+name+" in rules must be an array of arrays with two elements");
                }
            });
        }
        if(isTwoLevel) {
            list = {path:list};
        }
        lists[name].get(type).push(list);
    };

    if(O.serviceImplemented("haplo:descriptive_object_labelling:setup")) {
        O.service("haplo:descriptive_object_labelling:setup", function(type, rules) {
            if(rules.selfLabelling) {
                typeIsSelfLabelling.set(type, true);
            }
            if(rules.labelWithCreator) {
                typeLabelWithCreator.set(type, true);
            }
            if(rules.workflowPermissionLabels) {
                if(O.serviceImplemented("std:workflow:get_additional_readers_for_object")) {
                    typeIsWorkflowIntegrated.set(type, true);
                } else {
                    throw new Error("Workflow permissions are not available unless the permissions plugin is loaded");
                }
            }
            applyList(type, rules, 'labels', false);
            applyList(type, rules, 'labelWith', false);
            applyList(type, rules, 'labelsFromLinked', true);
        });
    }

    // Build cleaned up labelling dictionaries
    var cleaned = function(name, isLabels, isTwoLevel) {
        var d = O.refdictHierarchical(), l = lists[name];
        l.each(function(type, value) {
            var flat = _.flatten(l.getAllInHierarchy(type));
            if(isTwoLevel) {
                flat = _.flatten(_.pluck(flat, 'path'),true);
                // Convert from [a,b],[a,c],[d,e] -> {a:[b,c] d:[e]}

                // When we support arbitrary chains, we will recurse
                // this operation over the value lists, in effect
                // converting a list of paths into a tree.

                var result = {};
                _.each(flat, function(pair) {
                    var key = pair[0];
                    var value = pair[1];

                    if(key in result) {
                        result[key].push(value);
                    } else {
                        result[key] = [value];
                    }
                });
                flat = result;
            } else {
                flat = isLabels ? O.labelList(flat) : _.uniq(flat);
            }
            d.set(type, flat);
        });
        return d;
    };
    typeLabels = cleaned('labels', true, false);
    typeLabelWith = cleaned('labelWith', false, false);
    typeLabelsFromLinked = cleaned('labelsFromLinked', false, true);

    // Work out what types should be updated on update of an object
    // (This does rely on the schema being up-to-date).
    typeLabelsFromLinked.each(function(type, descs) {
        _.each(descs,function(attrs, root) {
            root = parseInt(root,10); // root comes from an object
                                      // key, so gets autocast to a
                                      // string for us; we need the
                                      // integer back.

            // First attribute in the path points to an object we need to watch
            var attrInfo = SCHEMA.getAttributeInfo(root);
            if(attrInfo.types) {
                attrInfo.types.forEach(function(otherRef) {
                    updateLinkedForType.get(otherRef).push([root, type]);
                });
            }
        });
    });

    // Don't need to do anything again
    ensureSetup = function() {};
};

// --------------------------------------------------------------------------

var addLabels = function(changes, object) {
    ensureSetup();

    // Remove permissions rather than impersonate SYSTEM
    O.withoutPermissionEnforcement(function() {

        // Function to look up attributes and apply them to the changes
        var addLabelFromAttributes = function(type, from, attrs) {
            if(!attrs) {
                attrs = (typeLabelWith.get(type) || []);
            }
            attrs.forEach(function(desc) {
                from.every(desc, function(v,d,q) {
                    if(O.isRef(v)) {
                        changes.add(v, "with-parents");
                    }
                });
            });
        };

        // Object may have more than one type, combine each
        object.everyType(function(type) {

            // Label everything with type & parent types
            // TODO: Should there be an opt-out of labelling by type?
            changes.add(type, "with-parents");

            // Check object has a ref when self-labelling, might not have if
            // object isn't being saved right now.
            if(typeIsSelfLabelling.get(type) && object.ref) {
                changes.add(object.ref, "with-parents");
            }

            // Label with creator?
            if(typeLabelWithCreator.get(type)) {
                var creationUser = O.user(object.creationUid);
                if(creationUser.ref) {
                    changes.add(creationUser.ref);
                }
            }

            // Label with extra people from the workflow system?
            if(typeIsWorkflowIntegrated.get(type)) {
                var extraReaders = O.service("std:workflow:get_additional_readers_for_object", object);
                _.each(extraReaders, function(reader) {
                    if(reader.isGroup) {
                        throw new Error("Workflow permissions are not compatible with using groups as principals");
                    } else {
                        changes.add(reader.ref);
                    }
                });
            }

            // Simple labelling
            var labels = typeLabels.get(type);
            if(labels) { changes.add(labels); }

            // Label with simple attribute values
            addLabelFromAttributes(type, object);

            // Label with attributes from linked object
            _.each(typeLabelsFromLinked.get(type) || {}, function(attrs, root) {
                root = parseInt(root,10);
                object.every(root, function(v,d,q) {
                    if(O.isRef(v)) {
                        var linked = v.load();
                        if(linked) {
                            linked.everyType(function(linkedType) {
                                addLabelFromAttributes(linkedType, linked, attrs);
                            });
                        }
                    }
                });
            });
        });
    });
};

var replaceLabels = function(changes, object) {
    // Keep the 'label' labels only
    var keep = object.labels.filterToLabelsOfType([T.Label]);
    // Respect any explicit requests to change the labels by using the given changes to change the keep list
    keep = changes.change(keep);
    // Then change the changes to remove all the current labels except the keep labels
    changes.remove(object.labels);
    changes.add(keep);
    // Add all the 'content' labels configured by the other plugins
    addLabels(changes, object);
};

// --------------------------------------------------------------------------

// Label new objects
P.hook("hLabelObject", function(response, object) {
    addLabels(response.changes, object);
});

// Re-label existing objects
P.hook("hLabelUpdatedObject", function(response, object) {
    replaceLabels(response.changes, object);
});

// --------------------------------------------------------------------------

// Update linked objects
P.hook("hPostObjectChange", function(response, object, operation, previous) {
    // Only interested in update operations, because any other one doesn't affect other objects.
    if(operation !== "update") { return; }
    // This can take several seconds to run, which would cause a problematic pause in the UI, and
    // the user may be tempted to resubmit the form. So, run the relabelling as a background task.
    O.background.run("haplo_descriptive_object_labelling:update_linked_labels", {ref:object.ref.toString(), findPrevious:true});
});
P.backgroundCallback("update_linked_labels", function(data) {
    ensureSetup();

    // Impersonate SYSTEM so it doesn't show up in Recent listing
    // and is attributed to an automatic process.
    O.impersonating(O.SYSTEM, function() {
        var object = O.ref(data.ref).load();
        var previous;
        if(data.findPrevious) {
            var history = object.history;
            previous = (history && history.length) ? history[history.length-1] : object;
        }
        // We don't want to look at structure objects
        if(object.labels.includes(Label.Structure)) { return; }
        // Find list of stuff which needs relabelling
        var relevantLinks = [];
        updateLinkedForType.each(function(type, links) {
            if(object.isKindOf(type) || (previous && previous.isKindOf(type))) {
                relevantLinks = relevantLinks.concat(links);
            }
        });
        // Stop now if there's nothing to do
        if(relevantLinks.length === 0) { return; }
        // Build a search for relevant stuff linked to this object
        // Include ARCHIVED objects to maintain labelling with historical data.
        var toRelabel = O.query().or(function(subquery) {
            _.each(relevantLinks, function(l) {
                var desc = l[0], type = l[1];
                subquery.and(function(sq2) { sq2.link(object.ref, desc).link(type, ATTR.Type); });
            });
        }).includeArchivedObjects().execute();
        // Relabel all the relevant objects found
        _.each(toRelabel, function(o) {
            var changes = O.labelChanges();
            replaceLabels(changes, o);
            o.relabel(changes);
        });
    });
});
