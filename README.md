# UNO TV

A local multiplayer UNO game for family game night.

**TV shows the shared board. Phones show each player's private hand.**

## How to run

1. Make sure you have [Node.js](https://nodejs.org) installed.
2. Open a terminal in this folder.
3. Run:
   ```
   npm install
   npm start
   ```
4. On the computer connected to your TV, open a browser to: **http://localhost:3000**
5. Click **Create Room (for TV)**.
6. A room code and phone URL will appear (something like `http://192.168.1.XX:3000`).
7. On each family member's phone (on the same Wi-Fi), open that URL, enter their name + the room code, and join.
8. When everyone is in, click **Start Game** on the TV.

## Controls

- **TV**: Shows the discard pile, current color, whose turn it is, and how many cards everyone has.
- **Phone**: Shows your hand. Tap a card to play it. For Wild cards, pick a color. Tap **Draw Card** if you can't play. Tap **Call UNO!** when you have one card left.

## Notes

- This is a simplified but playable version of UNO (standard 108-card deck).
- All devices must be on the same local network.
- No internet required after the initial `npm install`.
- Restart the server to clear rooms.

Enjoy the game night!
