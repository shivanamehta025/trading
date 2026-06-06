const admin =
require("../config/firebase");

async function sendNotification(
  token,
  title,
  body
) {
  try {

    await admin.messaging().send({

      token,

      notification: {
        title,
        body,
      },
    });

    console.log(
      "✅ Notification Sent"
    );

  } catch (err) {

    console.log(
      "❌ Notification Error",
      err
    );
  }
}

module.exports =
  sendNotification;