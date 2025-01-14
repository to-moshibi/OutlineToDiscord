import dotenv from "dotenv";
import express from "express";
import axios from "axios";

dotenv.config();

const app = express();
app.use(express.json());

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK;
const PORT = process.env.PORT || 3123;
const INCLUDE_COLLECTIONS = (process.env.INCLUDE_COLLECTIONS || "").split(',');

console.log("Allowed Collections: " + INCLUDE_COLLECTIONS);

app.post("/outline-webhook", async (req, res) => {
  const { event, payload } = req.body;

  if ( INCLUDE_COLLECTIONS[0].length > 1 ) { // I hope this is strong enough error handling 
    const documentCollection = await getDocumentCollection(payload.model.documentId);	  
    if (!INCLUDE_COLLECTIONS.includes(documentCollection)) {
      console.log("Skipping Comment");
      return res.sendStatus(200);
    }
  } 

  let embedData;

  switch (event) {
    case "documents.delete":
      embedData = createDeleteEmbed(payload);
      break;
    case "revisions.create":
      embedData = createRevisionEmbed(payload);
      break;
    case "documents.update":
      embedData = createUpdateEmbed(payload);
      break;
    case "webhookSubscriptions.update":
      embedData = createWebhookSubscriptionEmbed(payload);
      break;
    case "teams.update":
      embedData = createTeamUpdateEmbed(payload);
      break;
    case "documents.create":
      embedData = createDocumentCreateEmbed(payload);
      break;
    case "stars.create":
      embedData = createStarCreateEmbed(payload);
      break;
    case "stars.delete":
      embedData = createStarDeleteEmbed(payload);
      break;
    case "documents.title_change":
      embedData = createDocumentTitleChangeEmbed(payload);
      break;
    case "documents.publish":
      embedData = createDocumentPublishEmbed(payload);
      break;
    case "pins.create":
      embedData = createPinCreateEmbed(payload);
      break;
    case "documents.permanent_delete":
      embedData = createPermanentDeleteEmbed(payload);
      break;
    case "documents.archive":
      embedData = createDocumentArchiveEmbed(payload);
      break;
    case "comments.create":
      const documentCreateDetails = await getDocumentDetails(payload.model.documentId);
      embedData = createCommentEmbed(payload, documentCreateDetails);
      break;
    case "comments.delete":
      const documentDeleteDetails = await getDocumentDetails(payload.model.documentId);
      embedData = createCommentDeleteEmbed(payload, documentDeleteDetails);
      break;
    case "comments.update":
      const documentUpdateDetails = await getDocumentDetails(payload.model.documentId);
      embedData = createCommentUpdateEmbed(payload, documentUpdateDetails);
      break;

    default:
      console.log(
        "Unsupported event:",
        event,
        "Payload:",
        JSON.stringify(payload)
      );
      return res.sendStatus(200);
  }

  try {
    await axios.post(DISCORD_WEBHOOK_URL, { embeds: [embedData] });
    res.sendStatus(200);
  } catch (error) {
    console.error("Error sending Discord webhook:", error);
    res.sendStatus(500);
  }
});

function createDeleteEmbed(payload) {
  return {
    title: "📄 ドキュメントが消去されました",
    color: 0xff0000,
    fields: [
      { name: "タイトル", value: payload.model.title },
      { name: "消去者", value: payload.model.updatedBy.name },
      {
        name: "消去日時",
        value: new Date(payload.model.deletedAt).toLocaleString(),
      },
    ],
    footer: { text: `ドキュメントID: ${payload.model.id}` },
  };
}

function createPermanentDeleteEmbed(payload) {
  return {
    title: "🗑️ ドキュメントが永久に消去されました",
    color: 0xff0000,
    fields: [{ name: "イベントID", value: payload.id }],
    footer: {
      text: "このドキュメントは永久に消去され、復元することはできません",
    },
  };
}

function createRevisionEmbed(payload) {
  return {
    title: "📝 ドキュメントが修正されました",
    color: 0xffff00,
    fields: [
      { name: "タイトル", value: payload.model.title },
      { name: "修正者", value: payload.model.createdBy.name },
      {
        name: "修正日時",
        value: new Date(payload.model.createdAt).toLocaleString(),
      },
    ],
    footer: { text: `Document ID: ${payload.model.documentId}` },
  };
}

function createUpdateEmbed(payload) {
  return {
    title: "🔄 ドキュメントがアップデートされました",
    color: 0x00ff00,
    fields: [
      { name: "タイトル", value: payload.model.title },
      { name: "アップデート者", value: payload.model.updatedBy.name },
      {
        name: "アップデート日時",
        value: new Date(payload.model.updatedAt).toLocaleString(),
      },
    ],
    footer: { text: `ドキュメントID: ${payload.model.id}` },
  };
}

function createWebhookSubscriptionEmbed(payload) {
  return {
    title: "🔗 Webhook の登録が更新されました",
    color: 0x00ffff,
    fields: [
      { name: "名前", value: payload.model.name },
      { name: "URL", value: payload.model.url },
      { name: "イベント", value: payload.model.events.join(", ") },
      { name: "有効", value: payload.model.enabled ? "はい" : "いいえ" },
      {
        name: "更新日時",
        value: new Date(payload.model.updatedAt).toLocaleString(),
      },
    ],
    footer: { text: `Subscription ID: ${payload.model.id}` },
  };
}

function createTeamUpdateEmbed(payload) {
  return {
    title: "👥 チームが更新されました",
    color: 0xffa500,
    fields: [
      { name: "名前", value: payload.model.name },
      { name: "URL", value: payload.model.url },
    ],
    footer: { text: `チームID: ${payload.model.id}` },
  };
}

function createDocumentCreateEmbed(payload) {
  return {
    title: "📄 新しいドキュメントが作成されました",
    color: 0x00ff00,
    fields: [
      { name: "タイトル", value: payload.model.title || "未設定" },
      { name: "作成者", value: payload.model.createdBy.name },
      {
        name: "作成日時",
        value: new Date(payload.model.createdAt).toLocaleString(),
      },
    ],
    footer: { text: `ドキュメントID: ${payload.model.id}` },
  };
}

function createStarCreateEmbed(payload) {
  return {
    title: "⭐ スターが付けられました",
    color: 0xffd700,
    fields: [
      {
        name: "タイプ",
        value: payload.model.documentId ? "ドキュメント" : "コレクション",
      },
      {
        name: "付けられた日時",
        value: new Date(payload.model.createdAt).toLocaleString(),
      },
    ],
    footer: { text: `Star ID: ${payload.model.id}` },
  };
}

function createStarDeleteEmbed(payload) {
  return {
    title: "🚫 スターが消去されました",
    color: 0x808080,
    fields: [{ name: "消去日時", value: new Date().toLocaleString() }],
    footer: { text: `Star ID: ${payload.id}` },
  };
}

function createDocumentTitleChangeEmbed(payload) {
  return {
    title: "✏️ ドキュメントのタイトルが変更されました",
    color: 0x1e90ff,
    fields: [
      { name: "新しいタイトル", value: payload.model.title },
      { name: "更新者", value: payload.model.updatedBy.name },
      {
        name: "Changed At",
        value: new Date(payload.model.updatedAt).toLocaleString(),
      },
    ],
    footer: { text: `ドキュメントID: ${payload.model.id}` },
  };
}

function createDocumentPublishEmbed(payload) {
  return {
    title: "🌐 ドキュメントが公開されました",
    color: 0x32cd32,
    fields: [
      { name: "タイトル", value: payload.model.title },
      { name: "公開者", value: payload.model.updatedBy.name },
      {
        name: "公開日時",
        value: new Date(payload.model.publishedAt).toLocaleString(),
      },
    ],
    footer: { text: `ドキュメントID: ${payload.model.id}` },
  };
}

function createPinCreateEmbed(payload) {
  return {
    title: "📌 ピンされました",
    color: 0xdc143c,
    fields: [
      {
        name: "タイプ",
        value: payload.model.documentId ? "ドキュメント" : "コレクション",
      },
      {
        name: "ピンされた日時",
        value: new Date(payload.model.createdAt).toLocaleString(),
      },
    ],
    footer: { text: `ピンID: ${payload.model.id}` },
  };
}

function createDocumentArchiveEmbed(payload) {
  return {
    title: "🗄️ ドキュメントがアーカイブされました",
    color: 0x808080,
    fields: [
      { name: "タイトル", value: payload.model.title },
      { name: "アーカイブした人", value: payload.model.updatedBy.name },
      {
        name: "アーカイブ日時",
        value: new Date(payload.model.archivedAt).toLocaleString(),
      },
    ],
    footer: { text: `ドキュメントID: ${payload.model.id}` },
  };
}

function createCommentEmbed(payload, documentDetails) {
  return {
    title: "💬 新しいコメント",
    color: 0x1e90ff,
    fields: [
      { name: "コメント", value: payload.model.data.content[0].content[0].text },
      { name: "コメントした人", value: payload.model.createdBy.name },
      { name: "ドキュメントのタイトル", value: documentDetails.title },
      { name: "ドキュメントのリンク", value: `${process.env.OUTLINE_URL}${documentDetails.url}` // Link to the document
      },
    ],
    footer: { name: "作成日時", value: new Date(payload.model.createdAt).toLocaleString() },
  };
}

function createCommentDeleteEmbed(payload, documentDetails) {
  return {
    title: "🗑️ コメントが消去されました",
    color: 0xff0000,
    fields: [
      { name: "消去した人", value: payload.model.createdBy.name },
      { name: "ドキュメントのタイトル", value: documentDetails.title },
      { name: "ドキュメントのリンク", value: `${process.env.OUTLINE_URL}${documentDetails.url}` },
    ],
    footer: { text: `コメントID: ${payload.model.id} - 消去日時: ${new Date().toLocaleString()}` },
  };
}

function createCommentUpdateEmbed(payload, documentDetails) {
  return {
    title: "✏️ コメントが更新されました",
    color: 0x1e90ff,
    fields: [
      { name: "更新されたコメント", value: payload.model.data.content[0].content[0].text },
      { name: "更新した人", value: payload.model.createdBy.name },
      { name: "ドキュメントのタイトル", value: documentDetails.title },
      { name: "ドキュメントのリンク", value: `${process.env.OUTLINE_URL}${documentDetails.url}` },
    ],
    footer: { text: `コメントID: ${payload.model.id} - 更新日時: ${new Date(payload.model.updatedAt).toLocaleString()}` },
  };
}


async function getDocumentDetails(documentId) {
  try {
    const response = await axios.post(
        `${process.env.OUTLINE_URL}/api/documents.info`,
        { id: documentId },
        {
          headers: { Authorization: `Bearer ${process.env.OUTLINE_API_KEY}` },
        }
    );

    const document = response.data.data;
    return {
      title: document.title,
      url: document.url,
    };
  } catch (error) {
    console.error("Error fetching document details:", error);
    return { title: "Unknown Document", url: "#" };
  }
}

async function getDocumentCollection(documentId) {
  try {
    const response = await axios.post(
        `${process.env.OUTLINE_URL}/api/documents.info`,
        { id: documentId },
        {
          headers: { Authorization: `Bearer ${process.env.OUTLINE_API_KEY}` },
        }
    );

    return response.data.data.collectionId;
  } catch (error) {
    console.error("Error fetching document collectionId:", error);
    return { title: "Unknown Document", url: "#" };
  }
}



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Outline webhook URL: http://domain:${PORT}/outline-webhook`);
});
