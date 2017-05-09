/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var getListOfPeopleFromRecord = function(object) {
    var people = [];
    object.every(function(v,d,q) {
        if(!O.isRef(v)) { return; }
        var valueObj = v.load();
        if(!valueObj.isKindOf(T.Person)) { return; }
        var nameFields = valueObj.firstTitle().toFields();
        var email = valueObj.first(A.EmailAddress);
        var details = {
            email: email ? email.toString() : undefined,
            title: valueObj.title,
            name: nameFields ? {first: nameFields.first, last: nameFields.last} : undefined
        };
        people.push({
            person: details,
            desc: SCHEMA.getAttributeInfo(d).code,
            qual: q ? SCHEMA.getQualifierInfo(q).code : undefined
        });
    });
    return people;
};

var getCommitteeData = function(committee) {
    var riRef = committee.first(A.ResearchInstitute); // TODO: support multiple research institutes?
    var ri = riRef ? riRef.load() : undefined;
    var attributes = getListOfPeopleFromRecord(committee);
    var titles = _.map(committee.everyTitle(), function(title) { return title.toString(); });
    return {
        oldRef: committee.ref.toString(),
        type: SCHEMA.getTypeInfo(committee.first(A.Type)).code,
        titles: titles,
        researchInstitute: ri ? ri.title : undefined,
        attributes: attributes
    };
};

var exportAllCommittees = function() {
    var data = [];
    var committees = O.query().link(T.Committee, A.Type).execute();
    committees.each(function(committee) {
        var committeeData = getCommitteeData(committee);
        if(committeeData) { data.push(committeeData); }
    });
    return data;
};

var getInstituteData = function(ri) {
    var attributes = getListOfPeopleFromRecord(ri);
    if(!attributes.length) { return; }
    return { oldRef: ri.ref.toString(), title: ri.title, attributes: attributes };
};

var exportAllInstitutes = function() {
    var data = [];
    var institutes = O.query().link(T.ResearchInstitute, A.Type).execute();
    institutes.each(function(ri) {
        var riData = getInstituteData(ri);
        if(riData) { data.push(riData); }
    });
    return data;
};

P.respond("GET", "/do/haplo-role-importer/export-all", [
], function(E) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    var data = {};
    data.institutes = exportAllInstitutes();
    data.committees = exportAllCommittees();
    E.response.body = JSON.stringify(data, undefined, 2);
    E.response.kind = "json";
});

