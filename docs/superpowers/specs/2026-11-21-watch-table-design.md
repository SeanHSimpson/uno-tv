# Watch a table from another screen — short design

**Why:** a friend or family member somewhere else wants to see the table on their own computer or TV and play on their phone.

**What:** the home page's "On the TV?" panel gets "or watch a table already going": a room-code box and a **Watch table** button. A valid code opens that room's live TV view on this screen (address becomes `/?tv=CODE`, so refresh/bookmark keeps it). A wrong code shows "Can't find that room. Check the code on the TV." They join on their phone with the same code as usual.

**Approaches:** (1) home-page code box → existing TV view (chosen: the server already supports any number of TV screens per room); (2) a watch-only TV mode (rejected by the user: remote screens keep the TV's start/deal buttons); (3) share links only (no way in without the link).

**Non-goals:** syncing music between screens; restricting what a remote screen can do.
