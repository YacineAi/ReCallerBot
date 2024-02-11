const express = require('express');
const app = express();
const ejs = require("ejs");
const os = require('os');
const smser = require("./smser");
const search = require("./search");
const Botly = require("botly");
const axios = require("axios");
const botly = new Botly({
    accessToken: process.env.PAGE_ACCESS_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    webHookPath: process.env.WB_PATH,
    notificationType: Botly.CONST.REGULAR,
    FB_URL: "https://graph.facebook.com/v2.6/",
});
const countries = require('./countries.json');
/* ----- DB ----- */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY, { auth: { persistSession: false} });
//const truebase = createClient(process.env.TB_URL, process.env.TB_KEY, { auth: { persistSession: false} });

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.json({ verify: botly.getVerifySignature(process.env.APP_SECRET) }));
app.use(express.urlencoded({ extended: false }));
app.use("/webhook", botly.router());

function formatBytes(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Byte";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

app.get("/", (req, res) => {
  const memoryUsage = process.memoryUsage();
  let uptimeInSeconds = process.uptime();

  let uptimeString = "";
  if (uptimeInSeconds < 60) {
    uptimeString = `${uptimeInSeconds.toFixed()} seconds`;
  } else if (uptimeInSeconds < 3600) {
    uptimeString = `${(uptimeInSeconds / 60).toFixed()} minutes`;
  } else if (uptimeInSeconds < 86400) {
    uptimeString = `${(uptimeInSeconds / 3600).toFixed()} hours`;
  } else {
    uptimeString = `${(uptimeInSeconds / 86400).toFixed()} days`;
  }

  const osInfo = {
    totalMemoryMB: (os.totalmem() / (1024 * 1024)).toFixed(2),
    freeMemoryMB: (os.freemem() / (1024 * 1024)).toFixed(2),
    cpus: os.cpus(),
  };

  res.render("index", { memoryUsage, uptimeString, formatBytes, osInfo });
});


/* ----- DB Qrs ----- */
async function createUser(user) {
  const { data, error } = await supabase
      .from('userbase')
      .insert([ user ]);

    if (error) {
      throw new Error('Error creating user : ', error);
    } else {
      return data
    }
};

async function updateUser(id, update) {
  const { data, error } = await supabase
    .from('userbase')
    .update( update )
    .eq('uid', id);

    if (error) {
      throw new Error('Error updating user : ', error);
    } else {
      return data
    }
};

async function userDb(userId) {
  const { data, error } = await supabase
    .from('userbase')
    .select('*')
    .eq('uid', userId);

  if (error) {
    console.error('Error checking user:', error);
  } else {
    return data
  }
};
/*
async function createTrue(user) {
  const { data, error } = await truebase
      .from('names')
      .insert([ user ]);

    if (error) {
      throw new Error('Error creating user : ', error);
    } else {
      return data
    }
};
*/
function phoneShaper(text) {
  var clean = text.replace(/\D/g, '');
  if (clean.length < 15 && clean.length > 8) {
      return clean
  } else {
    return "noneValid"  
  }
};

function smsShaper(text) {
  var clean = text.replace(/\D/g, '');
  if (clean.length == 6) {
      return clean
  } else {
    return "noneValid"  
  }
};

// ------- //
botly.on("message", async (senderId, message) => {
    const user = await userDb(senderId);
    if (user[0]) {
        if (message.message.text) {
            if (user[0].mode == "new") {
              botly.sendText({
                id: senderId,
                text: "لم يتم إختيار البلد! الرجاء اختيار البلد الخاص بك 🌍",
                quick_replies: [
                  botly.createQuickReply("الجزائر 🇩🇿", "dz"),
                  botly.createQuickReply("المغرب 🇲🇦", "ma"),
                  botly.createQuickReply("سوريا 🇸🇾", "sy"),
                  botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
                  botly.createQuickReply("السودان 🇸🇩", "sd"),
                  botly.createQuickReply("مصر 🇪🇬", "eg"),
                  botly.createQuickReply("More | المزيد", "more"),
                ],
              });
            } else if (user[0].mode == "global") {
              const clean = message.message.text.replace(/\D/g, '');
              if (/\d/.test(message.message.text) && clean.length > 6) {
                if (message.message.text.startsWith("+")) {
                  const search = await axios.get(`https://searchrouter.onrender.com/search?phone=${clean}`);
                  botly.sendGeneric({
                    id: senderId,
                    elements: {
                      title: `✅ | ${search.data.source2.name}`,
                      image_url: "https://i.ibb.co/StcT5v2/unphoto.jpg",
                      subtitle: `☑️ | ${search.data.source2.name}`,
                      buttons: [
                        botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                      ],
                    },
                    aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
                  });
                } else {
                  botly.sendText({
                  id: senderId,
                  text: "يجب أن يبدا الرقم بـ+ مثلا (+1) أو (+213) 📞.\nPhone number should start with + like (+1) or (+7) ...etc 📞.",
                });
                }
              } else {
                botly.sendText({
                  id: senderId,
                  text: "يرجى إدخال أرقام هواتف فقط 📞🙅🏻‍♂️.\nYou can only search for Phone Numbers 📞🙅🏻‍♂️.",
                });
              }
            } else {
              const clean = message.message.text.replace(/\D/g, '');
              if (/\d/.test(message.message.text) && clean.length > 6) {
                if (message.message.text.startsWith("+")) {
                  const search = await axios.get(`https://searchrouter.onrender.com/search?phone=${clean}`);
                  botly.sendGeneric({
                    id: senderId,
                    elements: {
                      title: `✅ | ${search.data.source2.name}`,
                      image_url: "https://i.ibb.co/StcT5v2/unphoto.jpg",
                      subtitle: `☑️ | ${search.data.source2.name}`,
                      buttons: [
                        botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                      ],
                    },
                    aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
                  });
                } else {
                 const search = await axios.get(`https://searchrouter.onrender.com/search?phone=${user[0].phonecode}${clean}`);
                 botly.sendGeneric({
                  id: senderId,
                  elements: {
                    title: `✅ | ${search.data.source2.name}`,
                    image_url: "https://i.ibb.co/StcT5v2/unphoto.jpg",
                    subtitle: `☑️ | ${search.data.source2.name}`,
                    buttons: [
                      botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                    ],
                  },
                  aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
                });
                }
              } else {
                botly.sendText({
                  id: senderId,
                  text: "يرجى إدخال أرقام هواتف فقط 📞🙅🏻‍♂️.\nYou can only search for Phone Numbers 📞🙅🏻‍♂️.",
                });
              }
            }
        } else if (message.message.attachments[0].payload.sticker_id) {
           // botly.sendText({ id: senderId, text: "(Y)" });
        } else if (message.message.attachments[0].type == "image" || message.message.attachments[0].type == "audio" || message.message.attachments[0].type == "video") {
            botly.sendText({ id: senderId, text: "للأسف. لا يمكنني البحث بالوسائط 📷🤔 يرجى استعمال الارقام فقط"});
        }
    } else { // New User
      await createUser({uid: senderId, mode: "new"})
      .then((data, error) => {
        botly.sendText({
          id: senderId,
          text: "مرحباً بك 👋🏻\nكالربوت أول صفحة للبحث عن أرقام الهواتف 👤\nيمكنك 🫵🏻 البحث عن جميع الأرقام بشكل مجاني يوميا 😍\nلكن عليك أولا إختيار بلدك 😅\nإذن... ماهو بلدك ؟ 👇🏻",
          quick_replies: [
            botly.createQuickReply("الجزائر 🇩🇿", "dz"),
            botly.createQuickReply("المغرب 🇲🇦", "ma"),
            botly.createQuickReply("سوريا 🇸🇾", "sy"),
            botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
            botly.createQuickReply("السودان 🇸🇩", "sd"),
            botly.createQuickReply("مصر 🇪🇬", "eg"),
            botly.createQuickReply("More | المزيد", "more"),
          ],
        });
      });
    }
});

botly.on("postback", async (senderId, message, postback) => {
  const user = await userDb(senderId);
  if (user[0]) {
    if (message.postback) { // Buttons
      if (postback == "GET_STARTED") {
        if (user[0]) {
          botly.sendText({id: senderId, text: "مرحبا بك مرة اخرى في كالربوت 😀💜"});
        } else {
          //
         }
      } else if (postback == "Profile") {
        botly.sendButtons({
          id: senderId,
          text: `البلد الحالي 🌐 : ${user[0].countryflag}`,
          buttons: [
            botly.createPostbackButton("تغيير البلد 🌐", "recountry")
          ],
        });
      } else if (postback == "1") {
      } else if (postback == "2") {
      } else if (postback == "3") {
      } else if (postback == "recountry") {
        botly.sendText({
          id: senderId,
          text: "يرجى إختيار البلد 🌐 الذي تريد التغيير له ☑️",
          quick_replies: [
            botly.createQuickReply("الجزائر 🇩🇿", "dz"),
            botly.createQuickReply("المغرب 🇲🇦", "ma"),
            botly.createQuickReply("سوريا 🇸🇾", "sy"),
            botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
            botly.createQuickReply("السودان 🇸🇩", "sd"),
            botly.createQuickReply("مصر 🇪🇬", "eg"),
            botly.createQuickReply("More | المزيد", "more"),
          ],
        });
      } else if (postback.startsWith("cn-")) {
        //
      } else if (message.postback.title == "1") {
        //
      } else if (message.postback.title == "2") {
        //
      } else if (message.postback.title == "3") {
        //
      } else if (message.postback.title == "4") {
        //
      } else {
        botly.sendText({
          id: senderId,
          text: "تم تغيير طريقة العمل يرجى استعمال ازرار جديدة",
        });
      }
    } else { // Quick Reply
      if (postback == "more") {
        botly.sendText({
          id: senderId,
          text: "يرجى اختيار البلد",
          quick_replies: [
            botly.createQuickReply("تونس 🇹🇳", "tn"),
            botly.createQuickReply("ليبيا 🇱🇾", "ly"),
            botly.createQuickReply("الاردن 🇯🇴", "jo"),
            botly.createQuickReply("العراق 🇮🇶", "iq"),
            botly.createQuickReply("قطر 🇶🇦", "qa"),
            botly.createQuickReply("اليمن 🇾🇪", "ye"),
            botly.createQuickReply("Global 🌐 (عالمي)", "global")
          ],
        });
      } else if (postback.length == 2) {
        for (const country of countries.countries) {
          if (postback === country.code) {
            await updateUser(senderId, {mode: "free", country: postback, countryflag: country.name, phonecode: country.phonecode})
            .then((data, error) => {
              if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
              botly.sendText({
                id: senderId,
                text: "نجاح ✅\nتم إختيار بلدك 💜\nيمكنك البحث عن ارقام الهواتف يوميا 📱",
              });
            });
            break;
          }
        }
      } else if (postback == "global") {
        await updateUser(senderId, {mode: "global"})
            .then((data, error) => {
              if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
              botly.sendText({
                id: senderId,
                text: "نجاح ✅🌐\nانت في الوضع العالمي. أكتب رقم الهاتف مع رمز البلد... كمثال :\n+213612345678\n•================•\nSuccess ✅🌐\nYou're Now in Global mode. Type any phone number you want to search. but you need to add country code like this :\n+213612345678",
              });
            });
      } else if (postback == "4") {
        //
      } else if (postback == "5") {
        //
      } else if (message.message.text == "1") {
        //
      } else if (message.message.text == "2") {
        //
      } else if (message.message.text == "3") {
        //
      } else if (message.message.text == "4") {
        //
      } else {
        botly.sendText({
          id: senderId,
          text: "تم تغيير طريقة العمل يرجى استعمال ازرار جديدة",
        });
      }
    }
  } else {
    await createUser({uid: senderId, mode: "new"})
          .then((data, error) => {
            botly.sendText({
              id: senderId,
              text: "مرحباً بك 👋🏻\nكالربوت أول صفحة للبحث عن أرقام الهواتف 👤\nيمكنك 🫵🏻 البحث عن أرقام الهواتف بشكل مجاني يوميا 😍\nلكن عليك أولا إختيار بلدك 😅\nإذن... ماهو بلدك ؟ 👇🏻",
              quick_replies: [
                botly.createQuickReply("الجزائر 🇩🇿", "dz"),
                botly.createQuickReply("المغرب 🇲🇦", "ma"),
                botly.createQuickReply("سوريا 🇸🇾", "sy"),
                botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
                botly.createQuickReply("السودان 🇸🇩", "sd"),
                botly.createQuickReply("مصر 🇪🇬", "eg"),
                botly.createQuickReply("More | المزيد", "more"),
              ],
            });
          });
  }
});

app.listen(3000, () => {
    console.log('App is on port : 3000');
});
