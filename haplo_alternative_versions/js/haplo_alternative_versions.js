/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Don't want altertative versions showing up in the search index, or be linked to in attributes etc.
// Keep the AuthoritativeVersion attribute in the index so they can be queried for from the authoritative record
P.hook("hPreIndexObject", function(response, object) {
    if(object.labels.includes(Label.AlternativeVersion)) {
        let r = response.replacementObject || object.mutableCopy();
        O.withoutPermissionEnforcement(() => {
            object.every((v,d,q) => {
                // don't remove files, so that file download permissions are granted
                if(d !== A.AuthoritativeVersion && O.typecode(v) !== O.T_IDENTIFIER_FILE) {
                    r.remove(d);
                }
            });
        });
        response.replacementObject = r;
    }
});

var alternateVersionsForObject = P.alternateVersionsForObject = function(auth, includeArchivedObjects) {
    return O.withoutPermissionEnforcement(() => {
        let q = O.query().link(auth, A.AuthoritativeVersion);
        if(includeArchivedObjects) {
            q.includeArchivedObjects();
        }
        return q.execute();
    });
};
P.implementService("haplo_alternative_versions:for_object", function(obj, includeArchivedObjects) {
    let ref = O.isRef(obj) ? obj : obj.ref;
    return alternateVersionsForObject(ref, includeArchivedObjects);
});

var copyDataFromAltToOther = function(alternateVersion, other, keepAdditionalAttributes) {
    O.withoutPermissionEnforcement(() => {
        // remove attributes from other
        let toRemove = [];
        // if keepAdditionalAttributes, only perform an additive copy onto the other object
        // otherwise wipe it completely apart from A.AuthoritativeVersion
        let removeFrom = keepAdditionalAttributes ? alternateVersion : other;
        removeFrom.every((v,d,q) => {
            if(d !== A.AuthoritativeVersion) {
                toRemove.push({desc: d, qual: q});
            }
        });
        _.chain(toRemove).
            uniq((descQual) => {
                // Uniq iteratees transform the values only for comparison, doesn't modify underlying array
                // Using the api codes so as to not rely on the data type of attributes/qualifiers and ensure
                // they form a distinct identifier for which values to replace
                let identifier = [SCHEMA.getAttributeInfo(descQual.desc).code];
                if(!!descQual.qual) { identifier.push(SCHEMA.getQualifierInfo(descQual.qual).code); }
                return identifier.join("-");
            }).
            each((descQual) => other.remove(descQual.desc, descQual.qual));

        let lastGroupId;
        alternateVersion.every((v,d,q,x) => {
            if(d !== A.AuthoritativeVersion) {
                if(x) {
                    // Prevent duplicating values within groups
                    if(lastGroupId === x.groupId) { return; }
                    lastGroupId = x.groupId;
                    let group = alternateVersion.extractSingleAttributeGroup(x.groupId);
                    group.every((vv,dd,qq) => {
                        // Attribute groups shouldn't be stored with types
                        // `group` only has a type as its a temporary object to represent the group
                        if(dd != A.Type) {
                            other.append(vv,dd,qq,x);
                        }
                    });
                } else {
                    other.append(v,d,q);
                }
            }
        });
    });
};

P.implementService("haplo_alternative_versions:copy_data_from_alternative_to_other", copyDataFromAltToOther);

P.implementService("haplo_alternative_versions:copy_data_to_authoritative", function(alternateVersion) {
    let s = O.serviceMaybe("haplo_alternative_versions:source_for_alternative_object", alternateVersion);
    let source = s ? s.source : undefined;
    let auth = alternateVersion.first(A.AuthoritativeVersion);
    let objectToUpdate = O.serviceMaybe("haplo_alternative_versions:update_replacement_object", source, O.currentUser, auth);
    let keepAdditionalAttributes = false;
    if(!objectToUpdate) {
        if(auth) {
            keepAdditionalAttributes = true;
            objectToUpdate = auth.load().mutableCopy();
        } else {
            // create new authoritative version
            objectToUpdate = O.object();
            let m = alternateVersion.mutableCopy();
            m.append(objectToUpdate.preallocateRef(), A.AuthoritativeVersion);
            O.impersonating(O.SYSTEM, () => { m.save(); });
        }
    }
    copyDataFromAltToOther(alternateVersion, objectToUpdate, keepAdditionalAttributes);
    O.impersonating(O.SYSTEM, () => objectToUpdate.save());
    let updated = objectToUpdate.ref.load();
    O.serviceMaybe("haplo_alternative_versions:update_database_information", alternateVersion, updated);
    O.serviceMaybe("haplo_alternative_versions:notify:updated_object", updated);
});

var changedAttributes = P.changedAttributes = function(alternative) {
    let changed = [];
    if(alternative.first(A.AuthoritativeVersion)) {
        let authority = alternative.first(A.AuthoritativeVersion).load();
        let sourceDescs = [];
        alternative.every((v,d,q) => sourceDescs.push(d));
        sourceDescs = _.uniq(sourceDescs);
        _.each(sourceDescs, (d) => {
            if(!authority.valuesEqual(alternative, d) && (d !== A.AuthoritativeVersion)) {
                changed.push(d);
            }
        });
    }
    return changed;
};
P.implementService("haplo_alternative_versions:changed_attributes", function(alternative) {
    return changedAttributes(alternative);
});
