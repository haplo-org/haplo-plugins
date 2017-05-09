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

    var anaesthetistUser = O.setup.createUser({email:"anaesthetist@example.com",nameFirst:"ANAESTHETIST",nameLast:"Smith",ref:anaesthetist.ref});
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

    var patientUser = O.setup.createUser({email:"patient@example.com",nameFirst:"PATIENT",nameLast:"Smith",ref:patient.ref});
    t.assert(patientUser.ref.toString() === patient.ref.toString());

    var meeting = O.object();
    meeting.appendType(T.Meeting);
    meeting.appendTitle("Plan for a brain transplant");
    meeting.append(nurse, A.Nurse);
    meeting.append(patient, A.Patient);
    meeting.save();

    var operation = O.object();
    operation.appendType(T.Operation);
    operation.appendTitle("Brain transplant");
    operation.append(surgeon, A.Surgeon);
    operation.append(anaesthetist, A.Anaesthetist);
    operation.append(meeting, A.Meeting);
    operation.save();

    // Reload all the things to get current labels
    surgeon = surgeon.ref.load();
    anaesthetist = anaesthetist.ref.load();
    nurse = nurse.ref.load();
    patient = patient.ref.load();
    meeting = meeting.ref.load();
    operation = operation.ref.load();

    // Useful
    var compareLabels = function(expected,got) {
        expected.sort();
        got = _.toArray(got);
        got.sort();
        if (!_.isEqual(expected,got)) {
            console.log("Expected", expected);
            console.log("Got", got);
            t.assert(false);
        }
    };

    // Check for correct labels, matching declarations in js/test_descriptive_object_labelling.js

    /*
      It can be useful to uncomment this if you get an assertion fail
      for the expected labels; then you have some idea of what the extra labels
      encountered might be.
    */
    /*
    console.log("Surgeon", surgeon.ref);
    console.log("Anaesthetist", anaesthetist.ref);
    console.log("Nurse", nurse.ref);
    console.log("Patient", patient.ref);

    console.log("Meeting", meeting.ref);
    console.log("Operation", operation.ref);
*/
    var mlabels = meeting.labels;
    var olabels = operation.labels;

    // Expected: patient
    compareLabels([T.Meeting, patient.ref], mlabels);

    // Expected: operation, Label.Messy, surgeon, patient
    // FIXME: Create as the anaesthetist user, and expect that user's label too
    compareLabels([T.Operation, operation.ref, Label.Messy, surgeon.ref, patient.ref], olabels);

    // The patient label on the operation comes via the meeting's
    // patient, thanks to the labelsFromLinked declaration. So let's
    // make the meeting's patient be the nurse, and see if that
    // changes the operation's labels.
    meeting = meeting.mutableCopy();
    meeting.remove(A.Patient);
    meeting.append(nurse,A.Patient);
    meeting.save();

    meeting = meeting.ref.load(); // Reload
    operation = operation.ref.load();
    mlabels = meeting.labels;
    olabels = operation.labels;
    compareLabels([T.Operation, operation.ref, Label.Messy, surgeon.ref, nurse.ref], olabels);
});
