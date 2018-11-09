title: Haplo user roles permissions
--

You should probably read this section for context if you haven't yet: [Labels and permissions](https://docs.haplo.org/setup/permissions).

h2(service). "haplo:user_roles_permissions:setup"

This is a service that is called in the permissions plugin and implemented in other plugins.

This service allows plugins to define the roles and the permissions that the plugin should grant to those roles. Permissions are granted through roles, so if another plugin in the dependency tree does not define the role you need, you will have to define it at this point.

The types of permissions you can grant and roles you can define through this service are:

| Function name | Arguments | Description |
| groupPersonalRole | group, role | This gives every member of @group@ a @role@. |
| groupPermission | group, permission, label | This gives every member of @group@ the @permission@ at the @label@. |
| groupRestrictionLabel | group, restrictionLabel | Apply the @restrictionLabel@ to @group@. |
| adminstratorGroup | | |
| attributeRole | role, type, desc, qual, objectAttr | Declare that an object O of @type@ referencing a user via attribute @desc@ (or @qual@.@desc@ if @qual@ is specified) has a role of "role at O" or, if @objectAttr@ is specified, "role at O.objectAttr".|
| roleIncludesAllPermissionsOfOtherRole | role, otherRole | Declare that a @role@ includes all the permissions from @otherRole@. |
| roleOversightPermission | role, permission, labelArray | Declare that a user has the given @permission@ on an object matching any of the labels in @labelArray@, if they have the specified @role@ at that object. |
| roleRestrictionLabelWithGlobalEffect | role, label | For any @role@ (no matter what their role is 'at') apply @label@ to the @role@. |
| roleProjectPermission | role, permission, labelArray | Currently does the exact same thing as roleOversightPermission. |

Note:

@role@ is always a human-readable string.
@permission@ can be one of: "read", "create", "read-create", "read-edit", "read-write". The latter allows the role to read, create, edit.
Objects, as always, are anything in the system - projects, research institutes, labels, etc.

h1. UserRoles interface

The UserRoles interface defines the roles a user has. Once you have obtained a @UserRoles@ object from the service below, there are a number of helpful functions you can call to determine whether that user should have access to what you are writing.

h2(service). "haplo:permissions:user_roles"

Takes in a user as an O.securityPrincipal object, and returns a @UserRoles@ object for that user.

h2(function). hasRole

Arguments: roleName, label. Returns: a boolean of whether the user has the @role@ at the given @label@.

h2(function). hasAnyRole

Arguments: zero or more role names as individual arguments. Returns: a boolean of whether the user has any of the roles provided, no matter the label the role applies to.


### Further reading

This is not the only way to apply and enforce permissions, and some of the above references the following.

- [Labels and permissions](https://docs.haplo.org/setup/permissions)
- [Restrictions](https://docs.haplo.org/dev/plugin/schema/restrictions)
- [Actions](https://docs.haplo.org/dev/plugin/o/action)
- [hUserPermissionRules](https://docs.haplo.org/dev/plugin/hook/user-permission-rules)
- [hUserAttributeRestrictionLabels](https://docs.haplo.org/dev/plugin/hook/user-attribute-restriction-labels)
- [hPreObjectEdit](https://docs.haplo.org/dev/plugin/hook/pre-object-edit) (the readOnlyAttributes part)
