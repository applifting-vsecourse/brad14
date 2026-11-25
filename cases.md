# Quack likes — test cases

## Confirmed rules and scope

- Only signed-in users can like or unlike a quack. A quack's author may like their own quack.
- Likes apply to live quacks and replies. A deleted-quack placeholder has no like control or count.
- A signed-in user can have at most one like per quack, and can remove it. Repeating the same like or unlike action does not change the count again.
- The count and the current user's liked state persist across reloads. Likes from other users do not need to update live; refreshing or reopening the feed is enough.
- After a failed like/unlike action, the previous count and liked state are restored and an error is shown.
- No separate empty state applies: an unliked quack displays a count of zero.

## Rules (unit tests)

### A user can like and unlike a quack

**Given** a live quack has zero likes and a signed-in user has not liked it<br>
**When** the user likes the quack<br>
**Then** the count becomes one and that user's liked state is true.

**Given** the user has liked the quack and its count is one<br>
**When** the user removes their like<br>
**Then** the count becomes zero and that user's liked state is false.

### One user contributes at most one like per quack

**Given** a user has already liked a quack and its count is one<br>
**When** the same like action is repeated<br>
**Then** the count remains one and the user still has one like.

**Given** a user has not liked a quack and its count is zero<br>
**When** the same unlike action is repeated<br>
**Then** the count remains zero and the user has no like.

### Likes belong to individual users and quacks

**Given** two signed-in users have both liked the same quack<br>
**When** one user removes their like<br>
**Then** the count decreases from two to one and the other user's liked state remains true.

**Given** a signed-in user is the author of a live quack<br>
**When** the author likes it<br>
**Then** the like is counted and the author's liked state is true.

### Replies can be liked

**Given** a live reply has no likes<br>
**When** a signed-in user likes the reply<br>
**Then** the reply's count becomes one and that user's liked state is true.

### Failed actions do not leave a false like state

**Given** a quack's count and liked state are visible<br>
**When** a like or unlike action fails<br>
**Then** the previous count and liked state are restored and an error is shown.

## API behaviour (integration tests)

### Authentication is required

**Given** a signed-out visitor<br>
**When** they send a like or unlike request for a quack<br>
**Then** the API responds with 401 and the quack's count and like state remain unchanged.

### A signed-in user can like and unlike

**Given** a signed-in user and a live quack with zero likes<br>
**When** the user likes it, then removes the like<br>
**Then** the API state changes from count one / liked to count zero / not liked.

### Repeated requests preserve the one-like rule

**Given** a signed-in user has already liked a quack<br>
**When** the API receives the same like action again<br>
**Then** the stored count remains one and the user has one like.

**Given** a signed-in user has no like on a quack<br>
**When** the API receives the same unlike action again<br>
**Then** the stored count remains zero and the user has no like.

### Like state is isolated by user and quack

**Given** two signed-in users and the same live quack<br>
**When** both users like it and one later removes their like<br>
**Then** the count is two and then one, and the remaining user's like is preserved.

**Given** a signed-in user and a live reply<br>
**When** the user likes the reply<br>
**Then** the reply has one like associated with that user.

### Missing or deleted quacks cannot receive likes

**Given** a quack has been deleted or its ID does not exist<br>
**When** a signed-in user tries to like it<br>
**Then** the API responds with 404 and no like count changes.

### Reloaded feed data reflects persisted likes

**Given** one user has liked a quack and another user has since liked it<br>
**When** the first user's feed data is requested again<br>
**Then** it reports the current aggregate count and the first user's liked state.

## End-to-end flow

### Like, reload, and take back a like

**Given** a signed-in user opens the feed and sees a live quack with count zero and an unselected heart<br>
**When** the user clicks the heart<br>
**Then** the count shows one and the heart appears selected.

**Given** the user has liked the quack<br>
**When** they reload or reopen the feed<br>
**Then** the count remains one and the heart remains selected.

**Given** the reloaded feed shows the user's like<br>
**When** the user clicks the selected heart<br>
**Then** the count returns to zero and the heart is no longer selected.
