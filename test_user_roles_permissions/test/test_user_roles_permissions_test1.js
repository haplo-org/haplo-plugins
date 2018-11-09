/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(function() {

    var surgeon = O.object();
    surgeon.appendType(T.Person);
    surgeon.appendTitle("SURGEON");
    surgeon.save();

    var surgeonUser = O.setup.createUser({email:"surgeon@example.com",nameFirst:"SURGEON",nameLast:"Smith",ref:surgeon.ref});
    t.assert(surgeonUser.ref.toString() === surgeon.ref.toString());

    var anaesthetist = O.object();
    anaesthetist.appendType(T.Person);
    anaesthetist.appendTitle("ANAESTHETIST");
    anaesthetist.save();

    var anaesthetistUser = O.setup.createUser({email:"anaesthetist@example.com",nameFirst:"ANAESTHETIST",nameLast:"Smith",ref:anaesthetist.ref,groups:[Group.Cleaners]});
    t.assert(anaesthetistUser.ref.toString() === anaesthetist.ref.toString());

    var nurse = O.object();
    nurse.appendType(T.Person);
    nurse.appendTitle("NURSE");
    nurse.save();

    var nurseUser = O.setup.createUser({email:"nurse@example.com",nameFirst:"NURSE",nameLast:"Smith",ref:nurse.ref});
    t.assert(nurseUser.ref.toString() === nurse.ref.toString());

    var patient = O.object();
    patient.appendType(T.Person);
    patient.appendTitle("PATIENT");
    patient.save();

    var patientUser = O.setup.createUser({email:"patient@example.com",nameFirst:"PATIENT",nameLast:"Smith",ref:patient.ref,groups:[Group.Admins]});
    t.assert(patientUser.ref.toString() === patient.ref.toString());

    var patient2 = O.object();
    patient2.appendType(T.Person);
    patient2.appendTitle("PATIENT");
    patient2.save();

    var patient2User = O.setup.createUser({email:"patient2@example.com",nameFirst:"PATIENT",nameLast:"Doe",ref:patient2.ref,groups:[Group.Admins]});
    t.assert(patient2User.ref.toString() === patient2.ref.toString());

    var meeting = O.object();
    meeting.appendType(T.Meeting);
    meeting.appendTitle("Plan for a brain transplant");
    meeting.append(surgeon, A.Surgeon);
    meeting.append(patient, A.Patient);
    meeting.append(patient2, A.Patient);
    meeting.save();

    var operation = O.object();
    operation.appendType(T.Operation);
    operation.appendTitle("Brain transplant");
    operation.append(nurse, A.Nurse);
    operation.append(anaesthetist, A.Anaesthetist);
    operation.append(meeting, A.Meeting);
    var lc = O.labelChanges();
    lc.add(Label.Messy);
    operation.save(lc);

    var assertCanRead = function(user, object) {
        O.impersonating(user, function() {
            var result = "none";
            try {
                object.ref.load();
                result = "success";
            } catch(e) {
                console.log("Caught unexpected exception:", e);
                result = "failure";
            }
            t.assert(result === "success");
        });
    };

    var assertCanWrite = function(user, object) {
        O.impersonating(user, function() {
            var result = "none";
            try {
                object.ref.load().mutableCopy().save();
                result = "success";
            } catch(e) {
                console.log("Caught unexpected exception:", e);
                result = "failure";
            }
            t.assert(result === "success");
        });
    };

    var assertCannotWrite = function(user, object) {
        O.impersonating(user, function() {
            var result = "none";
            try {
                object.ref.load().mutableCopy().save();
                result = "success";
            } catch(e) {
                console.log("Caught expected exception:", e);
                result = "failure";
            }
            t.assert(result === "failure");
        });
    };

    const assertHasRole = function(user, role, label) {
        const roles = O.service("haplo:permissions:user_roles", user);
        let result = "none";
        if(roles.hasRole(role, label.ref)) {
            result = "success";
        } else {
            console.log("Unexpected error: user "+user.ref+" does not have role "+role+" at label "+label.ref);
            result = "failure";
        }
        t.assert(result === "success");
    };

    /*
      It can be useful to uncomment this if you get a permission
      exception quoting the labels on an object; then you have some
      idea of what the extra labels encountered might be.
    */

    console.log("Surgeon", surgeon.ref, surgeon.ref.objId, surgeonUser.id);
    console.log("Anaesthetist", anaesthetist.ref, anaesthetist.ref.objId);
    console.log("Nurse", nurse.ref, nurse.ref.objId);
    console.log("Patient", patient.ref, patient.ref.objId);

    console.log("Meeting", meeting.ref, meeting.ref.objId, T.Meeting, T.Meeting.objId);
    console.log("Operation", operation.ref, operation.ref.objId, T.Operation, T.Operation.objId);

    // Check user roles
    var surgeonRoles = O.service("haplo:permissions:user_roles", surgeonUser);
    console.log("Surgeon roles", surgeonUser.ref, surgeonRoles);
    assertHasRole(surgeonUser, "Surgeon", patient);
    assertHasRole(surgeonUser, "Surgeon", patient2);

    // Check attribute roles
    assertCanRead(surgeonUser, meeting);
    assertCanWrite(surgeonUser, meeting);
    assertCannotWrite(nurseUser, meeting);

    assertCanRead(nurseUser, operation);
    assertCanWrite(nurseUser, operation);
    assertCannotWrite(surgeonUser, operation);

    // Check group roles: anaesthetist is a cleaner, operations are messy
    assertCanWrite(anaesthetistUser, operation);
    assertCannotWrite(anaesthetistUser, meeting);

    // Check group roles: patient is an admin, can do anything to
    // labels set with group permissions; in our case, that's messy,
    // which applies to the operation.
    assertCanWrite(patientUser, operation);

    // Check patients are "friends at themselves"
    assertCanWrite(patientUser, patient);
});
