/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(function() {
    var o1 = O.object();
    o1.appendType(T.Person);
    o1.appendTitle("O1");
    o1.save();

    var u1 = O.setup.createUser({email:"o1@example.com",nameFirst:"O1",nameLast:"Smith",ref:o1.ref});
    t.assert(u1.ref.toString() === o1.ref.toString());

    var o2 = O.object();
    o2.appendType(T.Person);
    o2.appendTitle("O2");
    o2.save();

    var u2 = O.setup.createUser({email:"o2@example.com",nameFirst:"O2",nameLast:"Smith",ref:o2.ref});
    t.assert(u2.ref.toString() === o2.ref.toString());

    var o3 = O.object();
    o3.appendType(T.Grief);
    o3.appendTitle("An unspeakably horrible event");
    o3.append(o1, A.Victim);
    o3.append(o2, A.Victor);
    o3.append("Tasty", A.Aroma);
    o3.save();

    // Test helpers

    var testPermissions = function(readers, writers, nonReaders, nonWriters) {
        // StoreObject (not Mutable) version of o3
        var o4 = o3.ref.load();

        // Check read labels
        var labels = o4.labels;
        _.each(labels, function(l) {
            console.log("label:", o4.ref, l.load());
        });

        /*
        var actualReaders = O.service("std:workflow:get_additional_readers_for_object", o4);
        var actualWriters = O.service("std:workflow:get_additional_writers_for_object", o4);
        var objCompare = function(a, b) {
            return a.ref-b.ref;
        };
        var compareObjectArrays = function(a, b) {
            t.assert(_.isEqual(a, b));
        };
        actualReaders.sort(objCompare);
        actualWriters.sort(objCompare);
        readers.sort(objCompare);
        writers.sort(objCompare);

        console.log("Readers:",actualReaders,readers);
        console.log("Writers:",actualWriters,writers);

        compareObjectArrays(actualReaders, readers);
        compareObjectArrays(actualWriters, writers);
*/
        // Check permissions
        _.each(readers, function(reader) {
            O.impersonating(reader, function() {
                var object = o4.ref.load();
                var data = object.every(A.Victim);
            });
        });

        _.each(writers, function(writer) {
            O.impersonating(writer, function() {
                var object = o4.ref.load().mutableCopy();
                object.append("More aromas", A.Aroma);
                object.save();
            });
        });

        // Check denials
        _.each(nonReaders, function(writer) {
            var permissionWasDenied = true;
            try {
                O.impersonating(writer, function() {
                    // This should therefore fail
                    var object = o3.ref.load();
                });
                permissionWasDenied = false;
            }
            catch (e) {
                console.log("Caught expected exception:", e);
            }
            t.assert(permissionWasDenied);
        });

        _.each(nonWriters, function(writer) {
            var permissionWasDenied = true;
            try {
                O.impersonating(writer, function() {
                    // This should therefore fail
                    var object = o3.ref.load().mutableCopy();
                    object.append("More aromas", A.Aroma);
                    object.save();
                });
                permissionWasDenied = false;
            }
            catch (e) {
                console.log("Caught expected exception:", e);
            }
            t.assert(permissionWasDenied);
        });
    };

    // Test!

    console.log("CREATE INSTANCE");
    var M = P.PermTestWorkflow.create({object: o3.ref.load()});
    console.log("TRANSITION: AWAKEN -> DENIAL");
    M.transition("awaken");

    // denial; o2, the victor, has read via the entity rule; o1, the victim, has read-write via the actionableBy rule
    console.log("TEST PERMISSIONS");
    testPermissions([u2,u1],[u1],[],[u2]);

    console.log("TRANSITION: PROCEED -> GUILT");
    M.transition("proceed");
    // guilt; o2, the victor, has read via the entity rule and read-write via the actionableBy rule; o1, the victim, has nothing
    testPermissions([u2],[u2],[u1],[u1]);

    console.log("TRANSITION: PROCEED -> ANGER");
    M.transition("proceed");
    // anger; o2, the victor, has read via the entity rule; o1, the victim, has read-write via the actionableBy rule
    testPermissions([u2,u1],[u1],[],[u2]);

    // Swap entity roles
    t.login(u1.id);
    M = P.PermTestWorkflow.instanceForRef(o3.ref);

    // o1 becomes victor
    console.log("o1 becomes victor");
    t.post("/do/workflow/replace/" + M.workUnit.id + "/original-victor/" + o2.ref,
           {"replacement":o1.ref.toString()},
           {plugin:"std_workflow"});
    console.log(t.last);

    M = P.PermTestWorkflow.instanceForRef(o3.ref);

    // o2 becomes victim
    console.log("o2 becomes victim");
    t.post("/do/workflow/replace/" + M.workUnit.id + "/original-victim/" + o1.ref,
           {"replacement":o2.ref.toString()},
           {plugin:"std_workflow"});
    console.log(t.last);

    M = P.PermTestWorkflow.instanceForRef(o3.ref);

    // anger; o1, the victor, has read via the entity rule; o2, the victim, has read-write via the actionableBy rule
    // ...except that ER doesn't updated actionableBy, so we can't test this case yet.
    // testPermissions([u1,u2],[u2],[],[u1]);

    console.log("TRANSITION: PROCEED -> DEPRESSION");
    t.login(u2.id);
    M.transition("proceed");
    // depression; actionableBy victim(o2), so same permissions as before transition

    M = P.PermTestWorkflow.instanceForRef(o3.ref);

    testPermissions([u2],[u2],[u1],[u1]);

    // Spare transitions to hang further tests off of, if needed
    /*
    M.transition("proceed");
    M.transition("proceed");
    M.transition("proceed");
    */

    // Tidy up

    // Having logged in with t.login, we are now in a user context, so must
    // impersonate O.SYSTEM to clear up.
    O.impersonating(O.SYSTEM, function() {
        o1.deleteObject();
        o2.deleteObject();
        o3.deleteObject();
        // TODO: Provide an API so we can delete the two test users, u1 and u2.
    });
});
