title: Haplo List Approval
module_owner: Am
--

h3(feature). haplo:list_approval

Use this feature to repeat a state for all people in a given entity. Once entered the state will be repeated for each user in the entity given before the state can be exited to a different state. The current user for the state is the @target@ role. To setup list approval for a state pass specification with the properties below:

h3(property). listEntity

**REQUIRED**: the name of the entity of people to repeat the state for.

h3(property). state

**REQUIRED**: the name of the state to apply list approval.

This state must have the actionable by set to @target@.

h3(property). forwardTransition

**REQUIRED**: the name of the transition on the state to be used for moving to the next person in the entity or exiting the state.

This transition should be defined on the state to have the first destination as the state (so we can repeat it) and the second destination as the destination post list approval.

h3(property). resetTransition

The name of the transition that if used requires a new approval from everyone in the entity whether they have recently approved or not.

By default when returning to the state the remaining people to approve will need to approve - which will be everyone if they have all previously approved. Use this property when a change in the application needs to be revisited by everyone in the entity by force.
