/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*
    When using these tests, the following schema will need to be manually applied to the system you're testing against:

    group haplo:group:test-one as TestGroup
        title: Test Group
*/


t.test(function() {

    // --------------------------------------------------------------------------
    // Set up test user and groups
    // --------------------------------------------------------------------------

    let testEmail = O.security.random.identifier()+"@example.com";
    let testEmail2 = O.security.random.identifier()+"@example.com";
    let testEmail3 = O.security.random.identifier()+"@example.com";
    let testEmail4 = O.security.random.identifier()+"@example.com";
    let serviceUser = O.serviceUser("haplo:service-user:api-v0:user");
    let testGroup1 = O.group(GROUP["haplo:group:test-one"]);
    let testGroup2 = O.setup.createGroup("Test Group 2");
    let testUser;
    let testUser2;
    let testUser3;
    let testUser4;

    try {
        // --------------------------------------------------------------------------
        // Test authorisation on create
        // --------------------------------------------------------------------------

        let unauthorisedResponse = t.request("POST", "/api/v0-user/create", {}, {
            kind: "json",
            body: {
                nameFirst: "Test",
                nameLast: "User",
                email: testEmail,
                localeId: "en"
            }
        });
        t.assertJSONBody(unauthorisedResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:not-permitted",
            "error": {
                "message": "User is not permitted to use this API"
            }
        });

        // --------------------------------------------------------------------------
        // Test creation API
        // --------------------------------------------------------------------------

        t.login(O.serviceUser("haplo:service-user:api-v0:user"));
        let failedUserCreateResponse = t.request("POST", "/api/v0-user/create", {}, {
            kind: "json",
            body: {
                nameFirst: "Bob"
            }
        });
        t.assertJSONBody(failedUserCreateResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:exception",
            "error": {
                "message": "org.jruby.exceptions.RaiseException: (JavaScriptAPIError) User must have a non-empty String nameLast attribute"
            }
        });

        let createUserResponse = t.request("POST", "/api/v0-user/create", {}, {
            kind: "json",
            body: {
                nameFirst: "Test",
                nameLast: "User",
                email: testEmail,
                localeId: "en",
                tags: {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });

        testUser = O.user(JSON.parse(createUserResponse.body).user.id);
        t.assertJSONBody(createUserResponse, {
            success: true,
            kind: "haplo:api-v0:user:create",
            user: {
                "id":testUser.id,
                "nameFirst":"Test",
                "nameLast":"User",
                "name":"Test User",
                "code":null,
                "email":testEmail,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });

        t.assert(testUser.isActive);
        t.assert(!testUser.isGroup);
        t.assert(!testUser.isSuperUser);
        t.assert(!testUser.isServiceUser);
        t.assert(!testUser.isAnonymous);
        t.assertEqual(testEmail, testUser.email);
        t.assertEqual("Test User", testUser.name);
        t.assertEqual("en", testUser.localeId);
        t.assert(testUser.isMemberOf(GROUP["std:group:everyone"]));
        t.assertEqual("testuser", testUser.tags.username);
        t.assertEqual("true", testUser.tags.other);

        let existingEmailResponse = t.request("POST", "/api/v0-user/create", {}, {
            kind: "json",
            body: {
                nameFirst: "Test",
                nameLast: "User",
                email: testEmail,
                localeId: "en"
            }
        });
        t.assertJSONBody(existingEmailResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:creation-failed",
            "error": {
                "message": "Could not create new user, as user already exists with email address "+testEmail
            }
        });

        let existingTagsResponse = t.request("POST", "/api/v0-user/create", {}, {
            kind: "json",
            body: {
                nameFirst: "Test",
                nameLast: "User",
                email: O.security.random.identifier()+"@example.com",
                localeId: "en",
                tags: {
                    username: "testuser"
                }
            }
        });
        t.assertJSONBody(existingTagsResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:creation-failed",
            "error": {
                "message": "Could not create new user, as user already exists with username tag testuser"
            }
        });

        let badRefResponse = t.request("POST", "/api/v0-user/create", {}, {
            kind: "json",
            body: {
                nameFirst: "Test",
                nameLast: "User",
                email: testEmail2,
                localeId: "en",
                ref: {id:"notARef"}
            }
        });
        t.assertJSONBody(badRefResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:exception",
            "error": {
                "message": "Could not add ref [object Object] to user as it is not a valid reference to an object"
            }
        });

        let badRefStringResponse = t.request("POST", "/api/v0-user/create", {}, {
            kind: "json",
            body: {
                nameFirst: "Test",
                nameLast: "User",
                email: testEmail2,
                localeId: "en",
                ref: "notARef"
            }
        });
        t.assertJSONBody(badRefStringResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:creation-failed",
            "error": {
                "message": "Could not add ref notARef to user as it is not a valid reference to an object"
            }
        });

        let testObject = O.object();
        testObject.appendType(TYPE["std:type:person"]);
        testObject.appendTitle("Test person");
        O.withoutPermissionEnforcement(() => {
            testObject.save();
        });

        let createUserWithGroupsResponse = t.request("POST", "/api/v0-user/create", {}, {
            kind: "json",
            body: {
                nameFirst: "Test2",
                nameLast: "User2",
                email: testEmail2,
                localeId: "cy",
                ref: testObject.ref.toString(),
                directGroupMembership:["haplo:group:test-one"],
                tags: {
                    username: "testuser2",
                    other: "true"
                }
            }
        });
        testUser2 = O.user(JSON.parse(createUserWithGroupsResponse.body).user.id);
        t.assertJSONBody(createUserWithGroupsResponse, {
            success: true,
            kind: "haplo:api-v0:user:create",
            user: {
                "id":testUser2.id,
                "nameFirst":"Test2",
                "nameLast":"User2",
                "name":"Test2 User2",
                "code":null,
                "email":testEmail2,
                "ref":testObject.ref.toString(),
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"cy",
                "directGroupMembership":["haplo:group:test-one"],
                "tags": {
                    "username": "testuser2",
                    "other": "true"
                }
            }
        });

        t.assert(testUser2.isActive);
        t.assert(!testUser2.isGroup);
        t.assert(!testUser2.isSuperUser);
        t.assert(!testUser2.isServiceUser);
        t.assert(!testUser2.isAnonymous);
        t.assertEqual(testEmail2, testUser2.email);
        t.assertEqual("Test2 User2", testUser2.name);
        t.assertEqual("cy", testUser2.localeId);
        t.assert(testUser2.isMemberOf(GROUP["std:group:everyone"]));
        t.assert(testUser2.isMemberOf(GROUP["haplo:group:test-one"]));
        t.assertEqual("testuser2", testUser2.tags.username);
        t.assertEqual("true", testUser2.tags.other);


        let createUserWithWelcomeEmailResponse = t.request("POST", "/api/v0-user/create", {welcomeLink:1}, {
            kind: "json",
            body: {
                nameFirst: "Test3",
                nameLast: "User3",
                email: testEmail3
            }
        });
        let testUser3Body = JSON.parse(createUserWithWelcomeEmailResponse.body);
        testUser3 = O.user(testUser3Body.user.id);
        t.assert("welcomeLink" in testUser3Body);
        t.assert(testUser3Body.welcomeLink.startsWith("https://"+O.application.hostname+"/do/authentication/welcome/"+testUser3Body.user.id));

        let createUserWithNoWelcomeEmailResponse = t.request("POST", "/api/v0-user/create", {welcomeLink:0}, {
            kind: "json",
            body: {
                nameFirst: "Test4",
                nameLast: "User4",
                email: testEmail4
            }
        });
        let testUser4Body = JSON.parse(createUserWithNoWelcomeEmailResponse.body);
        testUser4 = O.user(testUser4Body.user.id);
        t.assert(!("welcomeLink" in testUser4Body));

        // --------------------------------------------------------------------------
        // Test get details API
        // --------------------------------------------------------------------------

        t.loginAnonymous();

        let anonymousNotPermittedResponse = t.request("GET", "/api/v0-user/id/"+testUser.id);
        t.assertJSONBody(anonymousNotPermittedResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:not-permitted",
            "error": {
                "message": "User is not permitted to use this API"
            }
        });

        t.login(testUser);

        let userNotPermittedResponse = t.request("GET", "/api/v0-user/id/"+testUser.id);
        t.assertJSONBody(userNotPermittedResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:not-permitted",
            "error": {
                "message": "User is not permitted to use this API"
            }
        });

        t.login(O.serviceUser("haplo:service-user:api-v0:user"));

        let noUserResponse = t.request("GET", "/api/v0-user/id"); //No user specified
        t.assertJSONBody(noUserResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:no-details-provided",
            "error": {
                "message": "Either a user ID in the path of the request, or a tag query in the parameters must be provided."
            }
        });

        let badTagsUserResponse = t.request("GET", "/api/v0-user/id", {"usajfsdl":"jsadlkfj"}); //No user specified
        t.assertJSONBody(badTagsUserResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:no-tag-query-provided",
            "error": {
                "message": "A tag query was expected in the parameters of this request, but was not provided. To be included in a tag query, tag names must be prefixed by tag:"
            }
        });

        let nonexistentUserResponse = t.request("GET", "/api/v0-user/id/55"); //User which doesn't exist
        t.assertJSONBody(nonexistentUserResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:no-such-user",
            "error": {
                "message": "User ID 55 does not exist"
            }
        });

        let serviceUserGetResponse = t.request("GET", "/api/v0-user/id/"+serviceUser.id);
        t.assertJSONBody(serviceUserGetResponse, {
            success: true,
            kind: "haplo:api-v0:user:details",
            user: {
                "id":serviceUser.id,
                "nameFirst":null,
                "nameLast":null,
                "name":"API v0: User",
                "code":"haplo:service-user:api-v0:user",
                "email":null,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":true,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":["haplo:group:api-v0:user-api"],
                "tags": {}
            }
        });

        let serviceUserWithWrongTagsGetResponse = t.request("GET", "/api/v0-user/id/"+serviceUser.id, {"tag:username":"testuser"});
        t.assertJSONBody(serviceUserWithWrongTagsGetResponse, {
            success: true,
            kind: "haplo:api-v0:user:details",
            user: {
                "id":serviceUser.id,
                "nameFirst":null,
                "nameLast":null,
                "name":"API v0: User",
                "code":"haplo:service-user:api-v0:user",
                "email":null,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":true,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":["haplo:group:api-v0:user-api"],
                "tags": {}
            }
        });

        let testUserGetResponse = t.request("GET", "/api/v0-user/id/"+testUser.id);
        t.assertJSONBody(testUserGetResponse, {
            success: true,
            kind: "haplo:api-v0:user:details",
            user: {
                "id":testUser.id,
                "nameFirst":"Test",
                "nameLast":"User",
                "name":"Test User",
                "code":null,
                "email":testEmail,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });

        let noUserTagsResponse = t.request("GET", "/api/v0-user/id", {"tag:usajfsdl":"jsadlkfj"});
        t.assertJSONBody(noUserTagsResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:no-user-found",
            "error": {
                "message": "Tag query usajfsdl=jsadlkfj returned no users."
            }
        });

        let tooManyUsersTagsResponse = t.request("GET", "/api/v0-user/id", {"tag:other":"true"});
        t.assertJSONBody(tooManyUsersTagsResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:multiple-users-found",
            "error": {
                "message": "Tag query other=true returned more than one result."
            }
        });

        let testUserTagResponse = t.request("GET", "/api/v0-user/id", {"tag:username":"testuser"});
        t.assertJSONBody(testUserTagResponse, {
            success: true,
            kind: "haplo:api-v0:user:details",
            user: {
                "id":testUser.id,
                "nameFirst":"Test",
                "nameLast":"User",
                "name":"Test User",
                "code":null,
                "email":testEmail,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });

        let testUserTagsResponse = t.request("GET", "/api/v0-user/id", {"tag:username":"testuser","tag:other":"true"});
        t.assertJSONBody(testUserTagsResponse, {
            success: true,
            kind: "haplo:api-v0:user:details",
            user: {
                "id":testUser.id,
                "nameFirst":"Test",
                "nameLast":"User",
                "name":"Test User",
                "code":null,
                "email":testEmail,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });

        // --------------------------------------------------------------------------
        // Test find by tags API
        // --------------------------------------------------------------------------

        let noTagsResponse = t.request("GET", "/api/v0-user/find-by-tag");
        t.assertJSONBody(noTagsResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:no-tag-query-provided",
            "error": {
                "message": "A tag query was expected in the parameters of this request, but was not provided. To be included in a tag query, tag names must be prefixed by tag:"
            }
        });

        let badTagsResponse = t.request("GET", "/api/v0-user/find-by-tag", {"username":"testuser"});
        t.assertJSONBody(badTagsResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:no-tag-query-provided",
            "error": {
                "message": "A tag query was expected in the parameters of this request, but was not provided. To be included in a tag query, tag names must be prefixed by tag:"
            }
        });

        let nestedTagsResponse = t.request("GET", "/api/v0-user/find-by-tag", {"tag:username[anotherLevel]":"testuser"});
        t.assertJSONBody(nestedTagsResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:no-user-found",
            "error": {
                "message": "Tag query username[anotherLevel]=testuser returned no users."
            }
        });

        let noUsersForTagsResponse = t.request("GET", "/api/v0-user/find-by-tag", {"tag:username":"testuser6"});
        t.assertJSONBody(noUsersForTagsResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:no-user-found",
            "error": {
                "message": "Tag query username=testuser6 returned no users."
            }
        });

        let oneUserForTagResponse = t.request("GET", "/api/v0-user/find-by-tag", {"tag:username":"testuser"});
        t.assertJSONBody(oneUserForTagResponse, {
            "success": true,
            "kind": "haplo:api-v0:user:find-by-tag",
            "users": [testUser.id]
        });

        let oneUserForTagsResponse = t.request("GET", "/api/v0-user/find-by-tag", {"tag:username":"testuser","tag:other":"true"});
        t.assertJSONBody(oneUserForTagsResponse, {
            "success": true,
            "kind": "haplo:api-v0:user:find-by-tag",
            "users": [testUser.id]
        });

        let twoUsersForTagsResponse = t.request("GET", "/api/v0-user/find-by-tag", {"tag:other":"true"});
        t.assertJSONBody(twoUsersForTagsResponse, {
            "success": true,
            "kind": "haplo:api-v0:user:find-by-tag",
            "users": [testUser.id, testUser2.id]
        });

        // --------------------------------------------------------------------------
        // Test Group Details API
        // --------------------------------------------------------------------------

        let nonexistentGroupResponse = t.request("GET", "/api/v0-user/group/haplo:group:non-existent");
        t.assertJSONBody(nonexistentGroupResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:exception",
            "error": {
                "message": "Group with code haplo:group:non-existent does not exist"
            }
        });

        let nonexistentUnknownGroupResponse = t.request("GET", "/api/v0-user/group/group:999999");
        t.assertJSONBody(nonexistentUnknownGroupResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:exception",
            "error": {
                "message": "Group with code group:999999 does not exist"
            }
        });

        // Service users aren't returned by loadAllMembers()
        let serviceUserGroupResponse = t.request("GET", "/api/v0-user/group/haplo:group:api-v0:user-api");
        t.assertJSONBody(serviceUserGroupResponse, {
            success: true,
            kind: "haplo:api-v0:user:group-details",
            users: [],
            group: {
                "id":Group.UserAPI,
                "nameFirst":null,
                "nameLast":null,
                "name":"API v0: User",
                "code":"haplo:group:api-v0:user-api",
                "email":null,
                "ref":null,
                "isGroup":true,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":true,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {}
            }
        });

        // Service users aren't returned by loadAllMembers()
        let unknownServiceUserGroupResponse = t.request("GET", "/api/v0-user/group/group:"+Group.UserAPI);
        t.assertJSONBody(unknownServiceUserGroupResponse, {
            success: true,
            kind: "haplo:api-v0:user:group-details",
            users: [],
            group: {
                "id":Group.UserAPI,
                "nameFirst":null,
                "nameLast":null,
                "name":"API v0: User",
                "code":"haplo:group:api-v0:user-api",
                "email":null,
                "ref":null,
                "isGroup":true,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":true,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {}
            }
        });

        // --------------------------------------------------------------------------
        // Test change user API
        // --------------------------------------------------------------------------

        // No changes ---------------------------------------------------------------

        let testUserNoChangeResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "id":testUser.id,
                "nameFirst":"Test",
                "nameLast":"User",
                "name":"Test User",
                "code":null,
                "email":testEmail,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });
        t.assertJSONBody(testUserNoChangeResponse, {
            success: true,
            kind: "haplo:api-v0:user:update",
            user: {
                "id":testUser.id,
                "nameFirst":"Test",
                "nameLast":"User",
                "name":"Test User",
                "code":null,
                "email":testEmail,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });

        // Incorrect data -----------------------------------------------------------

        let groupUpdateFailedResponse = t.request("POST", "/api/v0-user/id/16", {}, {
            kind:"json",
            body:{
                "email": testEmail
            }
        });
        t.assertJSONBody(groupUpdateFailedResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:update-failed",
            "error": {
                "message": "User 16 is a Group and cannot be updated"
            }
        });

        let duplicateEmailFailedResponse = t.request("POST", "/api/v0-user/id/"+serviceUser.id, {}, {
            kind:"json",
            body:{
                "email": testEmail
            }
        });
        t.assertJSONBody(duplicateEmailFailedResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:update-failed",
            "error": {
                "message": "User "+serviceUser.id+" cannot be updated to have email "+testEmail+" as another user already has that email"
            }
        });

        let duplicateUsernameFailedResponse = t.request("POST", "/api/v0-user/id/"+serviceUser.id, {}, {
            kind:"json",
            body:{
                tags:{
                    username:"testuser"
                }
            }
        });
        t.assertJSONBody(duplicateUsernameFailedResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:update-failed",
            "error": {
                "message": "Could not set username tag to testuser for user "+serviceUser.id+" as a user already exists with that username."
            }
        });

        let noNameFirstFailedResponse = t.request("POST", "/api/v0-user/id/"+serviceUser.id, {}, {
            kind:"json",
            body:{
                "nameLast": "test"
            }
        });
        t.assertJSONBody(noNameFirstFailedResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:exception",
            "error": {
                "message": "org.jruby.exceptions.RaiseException: (JavaScriptAPIError) User must have a non-empty String nameFirst attribute"
            }
        });

        let badRefFailedResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "ref": {test:"test"}
            }
        });
        t.assertJSONBody(badRefFailedResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:exception",
            "error": {
                "message": "Could not add ref [object Object] to user as it is not a valid reference to an object"
            }
        });

        let badRefStringFailedResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "ref": "test"
            }
        });
        t.assertJSONBody(badRefStringFailedResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:update-failed",
            "error": {
                "message": "Could not add ref test to user as it is not a valid reference to an object"
            }
        });

        let badGroupsFailedResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "directGroupMembership": ["notAnID"]
            }
        });
        t.assertJSONBody(badGroupsFailedResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:exception",
            "error": {
                "message": "Group with code notAnID does not exist"
            }
        });

        let badLocaleIdFailedResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "localeId": "notAnID"
            }
        });
        t.assertJSONBody(badLocaleIdFailedResponse, {
            "success": false,
            "kind": "haplo:api-v0:generic:exception",
            "error": {
                "message": "org.jruby.exceptions.RaiseException: (JavaScriptAPIError) Unknown locale: notAnID"
            }
        });

        // --------------------------------------------------------------------------
        // Successful updates -------------------------------------------------------

        let testUserUpdateResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "nameFirst":"Test new"
            }
        });
        t.assertJSONBody(testUserUpdateResponse, {
            success: true,
            kind: "haplo:api-v0:user:update",
            user: {
                "id":testUser.id,
                "nameFirst":"Test new",
                "nameLast":"User",
                "name":"Test new User",
                "code":null,
                "email":testEmail,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });

        t.assertEqual(O.user(testUser.id).nameFirst, "Test new");

        let testUserUpdateResponseWithTags = t.request("POST", "/api/v0-user/id", {"tag:username":"testuser"}, {
            kind:"json",
            body:{
                "nameFirst":"Test2"
            }
        });
        t.assertJSONBody(testUserUpdateResponseWithTags, {
            success: true,
            kind: "haplo:api-v0:user:update",
            user: {
                "id":testUser.id,
                "nameFirst":"Test2",
                "nameLast":"User",
                "name":"Test2 User",
                "code":null,
                "email":testEmail,
                "ref":null,
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true"
                }
            }
        });

        t.assertEqual(O.user(testUser.id).nameFirst, "Test2");

        let object = O.object();
        object.appendType(TYPE["std:type:person"]);
        object.appendTitle("Test User");
        O.withoutPermissionEnforcement(() => {
            object.save();
        });

        let testUserUpdateRefResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "email": testEmail,
                "ref": object.ref.toString(),
                "localeId":"cy",
                "directGroupMembership":[],
                "tags": {
                    "new": "test"
                }
            }
        });
        t.assertJSONBody(testUserUpdateRefResponse, {
            success: true,
            kind: "haplo:api-v0:user:update",
            user: {
                "id":testUser.id,
                "nameFirst":"Test2",
                "nameLast":"User",
                "name":"Test2 User",
                "code":null,
                "email":testEmail,
                "ref":object.ref.toString(),
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"cy",
                "directGroupMembership":[],
                "tags": {
                    "username": "testuser",
                    "other": "true",
                    "new": "test"
                }
            }
        });

        t.assert(O.user(testUser.id).ref, object.ref);

        let testUserUpdateGroupResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "directGroupMembership":["haplo:group:test-one", "group:"+testGroup2.id]
            }
        });
        t.assertJSONBody(testUserUpdateGroupResponse, {
            success: true,
            kind: "haplo:api-v0:user:update",
            user: {
                "id":testUser.id,
                "nameFirst":"Test2",
                "nameLast":"User",
                "name":"Test2 User",
                "code":null,
                "email":testEmail,
                "ref":object.ref.toString(),
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"cy",
                "directGroupMembership":["haplo:group:test-one", "group:"+testGroup2.id],
                "tags": {
                    "username": "testuser",
                    "other": "true",
                    "new": "test"
                }
            }
        });

        let unknownGroupResponse = t.request("GET", "/api/v0-user/group/group:"+testGroup2.id);
        t.assertJSONBody(unknownGroupResponse, {
            success: true,
            kind: "haplo:api-v0:user:group-details",
            users: [testUser.id],
            group: {
                "id":testGroup2.id,
                "nameFirst":null,
                "nameLast":null,
                "name":"Test Group 2",
                "code":null,
                "email":null,
                "ref":null,
                "isGroup":true,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":true,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {}
            }
        });

        let existingGroupResponse = t.request("GET", "/api/v0-user/group/haplo:group:test-one");
        t.assertJSONBody(existingGroupResponse, {
            success: true,
            kind: "haplo:api-v0:user:group-details",
            users: [testUser.id, testUser2.id],
            group: {
                "id":GROUP["haplo:group:test-one"],
                "nameFirst":null,
                "nameLast":null,
                "name":"Test Group",
                "code":"haplo:group:test-one",
                "email":null,
                "ref":null,
                "isGroup":true,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":true,
                "localeId":"en",
                "directGroupMembership":[],
                "tags": {}
            }
        });

        t.assert(O.user(testUser.id).isMemberOf(testGroup2.id));
        t.assert(O.user(testUser.id).isMemberOf(GROUP["haplo:group:test-one"]));

        let testUserRemoveGroupResponse = t.request("POST", "/api/v0-user/id/"+testUser.id, {}, {
            kind:"json",
            body:{
                "directGroupMembership":["haplo:group:test-one"]
            }
        });
        t.assertJSONBody(testUserRemoveGroupResponse, {
            success: true,
            kind: "haplo:api-v0:user:update",
            user: {
                "id":testUser.id,
                "nameFirst":"Test2",
                "nameLast":"User",
                "name":"Test2 User",
                "code":null,
                "email":testEmail,
                "ref":object.ref.toString(),
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"cy",
                "directGroupMembership":["haplo:group:test-one"],
                "tags": {
                    "username": "testuser",
                    "other": "true",
                    "new": "test"
                }
            }
        });

        t.assert(!O.user(testUser.id).isMemberOf(testGroup2.id));
        t.assert(O.user(testUser.id).isMemberOf(GROUP["haplo:group:test-one"]));

        // --------------------------------------------------------------------------
        // Test setting active state of users
        // --------------------------------------------------------------------------

        let disableUserResponse = t.request("POST", "/api/v0-user/enable/"+testUser.id, {status:"block"});
        t.assertJSONBody(disableUserResponse, {
            "success": true,
            "kind": "haplo:api-v0:user:enable",
            "user": {
                "id":testUser.id,
                "nameFirst":"Test2",
                "nameLast":"User",
                "name":"Test2 User",
                "code":null,
                "email":testEmail,
                "ref":object.ref.toString(),
                "isGroup":false,
                "isActive":false,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"cy",
                "directGroupMembership":["haplo:group:test-one"],
                "tags": {
                    "username": "testuser",
                    "other": "true",
                    "new": "test"
                }
            }
        });

        // User needs to be reloaded for isActive to update
        t.assert(!O.user(testUser.id).isActive);

        let enableResponse = t.request("POST", "/api/v0-user/enable/"+testUser.id, {status:"active"});
        t.assertJSONBody(enableResponse, {
            "success": true,
            "kind": "haplo:api-v0:user:enable",
            "user": {
                "id":testUser.id,
                "nameFirst":"Test2",
                "nameLast":"User",
                "name":"Test2 User",
                "code":null,
                "email":testEmail,
                "ref":object.ref.toString(),
                "isGroup":false,
                "isActive":true,
                "isSuperUser":false,
                "isServiceUser":false,
                "isAnonymous":false,
                "localeId":"cy",
                "directGroupMembership":["haplo:group:test-one"],
                "tags": {
                    "username": "testuser",
                    "other": "true",
                    "new": "test"
                }
            }
        });

        let invalidStatusResponse = t.request("POST", "/api/v0-user/enable/"+testUser.id, {status:"carrots"});
        t.assertJSONBody(invalidStatusResponse, {
            "success": false,
            "kind": "haplo:api-v0:user:enable-failed",
            "error": {
                "message": "carrots is not a valid status"
            }
        });

        // User needs to be reloaded for isActive to update
        t.assert(O.user(testUser.id).isActive);
    } finally {
        //So these users don't mess up any subsequent tests
        if(testUser) {
            testUser.setIsActive(false); 
            testUser.tags.username = "";
            testUser.tags.other = "";
            testUser.saveTags();
        }
        if(testUser2) {
            testUser2.setIsActive(false); 
            testUser2.tags.username = "";
            testUser2.tags.other = "";
            testUser2.saveTags();
        }
        if(testUser3) { testUser3.setIsActive(false); }
        if(testUser4) { testUser4.setIsActive(false); }
    }
});
