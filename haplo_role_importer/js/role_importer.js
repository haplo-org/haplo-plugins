/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var appendPersonToObject = function(objectMutable, attr, log) {
    var personMatches = [];
    if(attr.person.email) { personMatches = O.query().link(T.Person, A.Type).
            freeText(attr.person.email, A.EmailAddress).execute(); }
    if(!personMatches.length) { personMatches = O.query().link(T.Person, A.Type).
            freeText(attr.person.title, A.Title).execute(); }
    if(!personMatches.length) { log.push("USER: Couldn't find match for user "+attr.person.title); return; }
    var person = personMatches[0];
    var desc = ATTR[attr.desc];
    var qual = attr.qual ? QUAL[attr.qual] : QUAL["std:qualifier:null"];
    if(objectMutable.has(person.ref, desc, qual)) { 
        log.push("WARNING: Skipping "+person.title+". Already added as "+SCHEMA.getAttributeInfo(desc).name+
            " to "+objectMutable.title);
    } else {
        log.push("USER: Adding "+person.title+" ("+person.ref+") as "+SCHEMA.getAttributeInfo(desc).name+
            " of "+objectMutable.title+" ("+objectMutable.ref+")");
        objectMutable.append(person.ref, desc, qual);
    }
};

var findInstituteByTitle = function(title, log) {
    var matches = O.query().link(T.ResearchInstitute, A.Type).freeText(title, A.Title).execute();
    if(matches.length === 0) { log.push("RI: Couldn't find match for "+title); return; }
    else if(matches.length > 1) { 
        var exactTitles = _.filter(matches, function(ri) {
            return ri.has(title, A.Title);
        });
        if(exactTitles.length === 1) { return exactTitles[0]; }
        else { log.push("RI: Multiple matches for "+title+" and couldn't find a single exact match. Skipping."); return; }
    }
    else if(matches.length === 1) { return matches[0]; }
};

var importAllCommittees = function(committees, log, dryRun) {
    _.each(committees, function(committee) {
        var c = O.object();
        c.appendType(TYPE[committee.type]);
        _.each(committee.titles, function(title) {
            c.appendTitle(title);
        });
        if(committee.researchInstitute) { 
            var ri = findInstituteByTitle(committee.researchInstitute, log);
            if(!ri) { log.push("WARNING: Committee "+c.title+" couldn't find a matching research institute"); }
            else { c.append(ri, A.ResearchInstitute); }
        }
        log.push("COMMITTEE: Adding committee "+c.title+" (research institute: "+committee.researchInstitute+")");
        _.each(committee.attributes, function(attr) {
            if(attr.person) {
                appendPersonToObject(c, attr, log);
            }
        });
        if(!dryRun) { log.push("COMMITTEE: Saving "+c.title); c.save(); }
    });
};

var importAllInstitutes = function(institutes, log, dryRun) {
    _.each(institutes, function(institute) {
        var ri = findInstituteByTitle(institute.title, log);
        if(ri) {
            var riMutable = ri.mutableCopy();
            _.each(institute.attributes, function(attr) {
                if(attr.person) {
                    appendPersonToObject(riMutable, attr, log);
                    if(!dryRun) { log.push("RI: Saving "+ri.title); riMutable.save(); }
                }
            });
        }
    });
};

P.respond("GET,POST", "/do/haplo-role-importer/import-all", [
    {parameter:"data", as:"json", optional:true},
    {parameter:"live", as:"string", optional:true}
], function(E, data, live) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    var log = [], dryRun = true;
    if(live) { dryRun = false; }
    if(data.institutes) { log.push("Institutes"); importAllInstitutes(data.institutes, log, dryRun); }
    if(data.committees) { log.push("Committees"); importAllCommittees(data.committees, log, dryRun); }
    E.render({
        live: live,
        log: log.join("\n"),
        data: JSON.stringify(data)
    });
});
