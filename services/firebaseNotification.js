const admin = require("../firebase");

async function sendNotification(
  token,
  title,
  body,
  data = {}
) {
const payload = {
  token,
  notification: {
    title,
    body,
  },
  data: {
    type: String(data.type ?? ""),
    fromUser: String(data.fromUser ?? ""),
    fromName: String(data.fromName ?? ""),
    referenceId: String(data.referenceId ?? ""),
    databaseName: String(data.databaseName ?? ""),
  },
  android: {
    priority: "high",
  },
  apns: {
    payload: {
      aps: {
        sound: "default",
      },
    },
  },
};

console.log("FCM Payload:");
console.log(JSON.stringify(payload, null, 2));

await admin.messaging().send(payload);

}

module.exports = sendNotification;