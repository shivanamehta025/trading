const admin = require("../firebase");

async function sendNotification(
  token,
  title,
  body,
  data = {}
) {

  try {

    await admin.messaging().send({

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
    });

    console.log("✅ Notification Sent");

  } catch (err) {

    console.log(err);

  }

}

module.exports = sendNotification;