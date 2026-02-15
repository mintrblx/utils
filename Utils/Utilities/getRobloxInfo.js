const { MessageFlags } = require("discord.js");
const axios = require("axios");

const RATE_LIMIT_DELAY = 2000;

let requestQueue = [];
let isProcessing = false;

const emptyResult = () => ({
  discordId: null,
  robloxId: null,
  robloxUsername: null,
  username: null,
  displayName: null,
  headshot: null,
  avatar: null,
  created: null,
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isInteractionContext = (ctx) => {
  if (!ctx) return false;
  if (typeof ctx.isRepliable === "function") {
    try {
      return ctx.isRepliable();
    } catch (_) {}
  }
  return (
    typeof ctx.reply === "function" &&
    typeof ctx.followUp === "function" &&
    ("deferred" in ctx || "replied" in ctx)
  );
};

const safeInteractionResponse = async (ctx, message) => {
  if (!isInteractionContext(ctx)) return;

  const payload =
    typeof message === "string"
      ? { content: message, flags: MessageFlags.Ephemeral }
      : {
          ...message,
          flags:
            message?.flags === undefined
              ? MessageFlags.Ephemeral
              : message.flags,
        };

  try {
    if ((ctx.deferred || ctx.replied) && typeof ctx.followUp === "function") {
      await ctx.followUp(payload);
    } else if (typeof ctx.reply === "function") {
      await ctx.reply(payload);
    }
  } catch (err) {
    console.error("Failed to send interaction response:", err.message);
  }
};

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  const { type, id, context, client, resolve } = requestQueue.shift();
  let settled = false;

  const finish = (value) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };

  try {
    if (!client?.config?.MINT_API) {
      console.error("MINT_API not available.");
      await safeInteractionResponse(context, "Verification not configured.");
      finish(emptyResult());
      return;
    }


    let apiUrl;
    if (type === "discord") {
      apiUrl = `https://api.mintsys.xyz/v1/api/public/discord-to-roblox?discordId=${id}`;
    } else if (type === "roblox") {
      apiUrl = `https://api.mintsys.xyz/v1/api/public/roblox-to-discord?robloxId=${id}`;
    } else {
      throw new Error("Invalid type. Must be 'discord' or 'roblox'.");
    }

    const headers = {
      "x-api-key": client.config.MINT_API,
      "Content-Type": "application/json",
    };

    if (context?.guildId) {
      headers["x-guild-id"] = context.guildId;
    }

    const response = await axios.get(apiUrl, { headers });

    const data = response.data;
    if (!data) {
      finish(emptyResult());
      return;
    }

    let robloxId = data.robloxId || null;
    let discordId = data.discordId || null;
    let robloxUsername = data.robloxUsername || null;

    let username = null;
    let displayName = null;
    let created = null;
    let headshotUrl = null;
    let bodyUrl = null;

    if (robloxId) {
      try {
        const userRes = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`);
        username = userRes.data.name;
        displayName = userRes.data.displayName;
        created = userRes.data.created;
      } catch (err) {
        console.error("Roblox user fetch error:", err.message);
      }

      try {
        const thumbRes = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`
        );
        headshotUrl = thumbRes.data.data?.[0]?.imageUrl || null;
      } catch (err) {
        console.error("Roblox headshot fetch error:", err.message);
      }

      try {
        const bodyRes = await axios.get(
          `https://thumbnails.roblox.com/v1/users/avatar?userIds=${robloxId}&size=352x352&format=Png`
        );
        bodyUrl = bodyRes.data.data?.[0]?.imageUrl || null;
      } catch (err) {
        console.error("Roblox body fetch error:", err.message);
      }
    }

    finish({
      discordId,
      robloxId,
      robloxUsername,
      username,
      displayName,
      created,
      headshot: headshotUrl,
      avatar: bodyUrl,
    });
  } catch (error) {
    console.error(
      `Error in ${type === "discord" ? "getRobloxInfo" : "getDiscordInfo"}:`,
      error.message
    );

    await safeInteractionResponse(
      context,
      "Failed to fetch info. Please try again later."
    );

    finish(emptyResult());
  } finally {
    await delay(RATE_LIMIT_DELAY);
    isProcessing = false;
    processQueue();
  }
}


async function getRobloxInfo(discordId, context, client) {
  return new Promise((resolve) => {
    requestQueue.push({ type: "discord", id: discordId, context, client, resolve });
    processQueue();
  });
}

async function getDiscordInfo(robloxId, context, client) {
  return new Promise((resolve) => {
    requestQueue.push({ type: "roblox", id: robloxId, context, client, resolve });
    processQueue();
  });
}

module.exports = { getRobloxInfo, getDiscordInfo };