# 🧩 Mint API Resolver

Simple utility for resolving **Discord ↔ Roblox accounts** using the Mint API.

---

## 🌐 Mint Endpoints

```
GET https://api.mintsys.xyz/v1/api/public/discord-to-roblox?discordId=ID
GET https://api.mintsys.xyz/v1/api/public/roblox-to-discord?robloxId=ID
```

Headers required:

```
x-api-key: YOUR_API_KEY
x-guild-id: GUILD_ID - Only Needed for Guild Locked Keys (GLOBAL Keys Dont Require)
```

---

## 📦 Exports

```js
getRobloxInfo(discordId, context, client)
getDiscordInfo(robloxId, context, client)
```

---

## ⚙️ Requirements

Your client must include:

```js
client.config = {
  MINT_API: "YOUR_API_KEY"
};
```

---

## 🔑 What It Does

- Resolves Discord ID → Roblox account
- Resolves Roblox ID → Discord account
- Returns structured account data
- Uses queue-based rate limiting
- Sends safe ephemeral interaction responses on failure
