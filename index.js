const express = require('express');
const app = express();
const ejs = require("ejs");
const os = require('os');
const smser = require("./smser");
const search = require("./search");
const Botly = require("botly");
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
const truebase = createClient(process.env.TB_URL, process.env.TB_KEY, { auth: { persistSession: false} });

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
      .from('users')
      .insert([ user ]);

    if (error) {
      throw new Error('Error creating user : ', error);
    } else {
      return data
    }
};

async function updateUser(id, update) {
  const { data, error } = await supabase
    .from('users')
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
    .from('users')
    .select('*')
    .eq('uid', userId);

  if (error) {
    console.error('Error checking user:', error);
  } else {
    return data
  }
};

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
    const timer = new Date().getTime() + 24 * 60 * 60 * 1000;
    const time = new Date().getTime();
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
                  botly.createQuickReply("المزيد", "more"),
                ],
              });
            } else if (user[0].mode == "free") {
              if (user[0].lastsearch == null) { // first use
                await updateUser(senderId, {lastsearch: timer, searchnums: 1})
                .then((data, error) => {
                  if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                  if (phoneShaper(message.message.text) === "noneValid") {
                    botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير صالح ❎\nيرجى كتابة الارقام المقبولة 📞☑️"});
                  } else {
                    eval(search.searchFree(senderId, user[0].country, phoneShaper(message.message.text), user[0].phonecode));
                  }
                });
              } else {
                if (user[0].lastsearch < time) { // 24h passed
                  await updateUser(senderId, {lastsearch: timer, searchnums: 1})
                    .then((data, error) => {
                      if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                      if (phoneShaper(message.message.text) === "noneValid") {
                        botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير صالح ❎\nيرجى كتابة الارقام المقبولة 📞☑️"});
                      } else {
                        eval(search.searchFree(senderId, user[0].country, phoneShaper(message.message.text), user[0].phonecode));
                      }
                    });
                } else {
                  if (user[0].searchnums >= 10) { // free limit
                    botly.sendButtons({
                      id: senderId,
                      text: "إنتهت عمليات البحث المجانية 🙌🏻\nيرجى إنتظار 24 ساعة ⏳ أو التسجيل برقم الهاتف 📱",
                      buttons: [
                        botly.createPostbackButton("تسجيل برقم الهاتف 📱", "ToPay"),
                      ],
                    });
                  } else {
                    await updateUser(senderId, {lastsearch: timer, searchnums: user[0].searchnums++})
                    .then((data, error) => {
                      if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                      if (phoneShaper(message.message.text) === "noneValid") {
                        botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير صالح ❎\nيرجى كتابة الارقام المقبولة 📞☑️"});
                      } else {
                        eval(search.searchFree(senderId, user[0].country, phoneShaper(message.message.text), user[0].phonecode));
                      }
                    });
                  }
                }
              }
            } else if (user[0].mode == "sms") {
              if (user[0].smsed == true) {
                if (time > user[0].lastsms) {
                  botly.sendText({id: senderId, text: "إنتهى وقت إدخال الكود ⏳🙌🏻\nتم إعادة حسابك للوضع المجاني. يرجى إستعمال رقم مختلف أو إعادة عملية التوثيق 📞"});
                } else {
                  if (smsShaper(message.message.text) === "noneValid") {
                    botly.sendText({id: senderId, text: "الكود الذي أدخلته غير صالح ❎\nيرجى كتابة الرقم المتكون من 6 أرقام الذي وصلك."});
                  } else {
                    smser.verifySMS(senderId, user[0].phone, user[0].country, user[0].phonecode, user[0].smsid, smsShaper(message.message.text));
                  }
                }
              } else {
                if (phoneShaper(message.message.text) === "noneValid") {
                  botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير صالح ❎\nيرجى كتابة الارقام المقبولة 📞☑️"});
                } else {
                  botly.sendButtons({
                    id: senderId,
                    text: `هل تؤكد أن هذا ${message.message.text} هو رقمك الصحيح ؟ 🤔`,
                    buttons: [
                      botly.createPostbackButton("نعم ✅", `cn-${message.message.text}`),
                      botly.createPostbackButton("لا ❎", "rephone"),
                    ],
                  });
                }
              }
            } else if (user[0].mode == "paid") {
              if (phoneShaper(message.message.text) === "noneValid") {
                botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير صالح ❎\nيرجى كتابة الارقام المقبولة 📞☑️"});
              } else {
                search.searchPaid(senderId, user[0].country, phoneShaper(message.message.text), user[0].phonecode , user[0].token);
              }
            }
        } else if (message.message.attachments[0].payload.sticker_id) {
           // botly.sendText({ id: senderId, text: "(Y)" });
        } else if (message.message.attachments[0].type == "image" || message.message.attachments[0].type == "audio" || message.message.attachments[0].type == "video") {
            botly.sendText({ id: senderId, text: "للأسف. لا يمكنني البحث بالوسائط 📷🤔 يرجى استعمال الارقام فقط"});
        }
    } else { // New User
      await createUser({uid: senderId, mode: "new", searchnums: 0})
      .then((data, error) => {
        botly.sendText({
          id: senderId,
          text: "مرحباً بك 👋🏻\nكالربوت أول صفحة للبحث عن أرقام الهواتف 👤\nيمكنك 🫵🏻 البحث عن 10 أرقام بشكل مجاني يوميا 😍\nلكن عليك أولا إختيار بلدك 😅\nإذن... ماهو بلدك ؟ 👇🏻",
          quick_replies: [
            botly.createQuickReply("الجزائر 🇩🇿", "dz"),
            botly.createQuickReply("المغرب 🇲🇦", "ma"),
            botly.createQuickReply("سوريا 🇸🇾", "sy"),
            botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
            botly.createQuickReply("السودان 🇸🇩", "sd"),
            botly.createQuickReply("مصر 🇪🇬", "eg"),
            botly.createQuickReply("المزيد", "more"),
          ],
        });
      });
    }
});

botly.on("postback", async (senderId, message, postback) => {
  const user = await userDb(senderId);
  
  if (message.postback) { // Buttons
    if (postback == "GET_STARTED") {
      if (user[0]) {
        botly.sendText({id: senderId, text: "مرحبا بك مرة اخرى في كالربوت 😀💜"});
      } else {
        await createUser({uid: senderId, mode: "new", searchnums: 0})
        .then((data, error) => {
          botly.sendText({
            id: senderId,
            text: "مرحباً بك 👋🏻\nكالربوت أول صفحة للبحث عن أرقام الهواتف 👤\nيمكنك 🫵🏻 البحث عن 10 أرقام بشكل مجاني يوميا 😍\nلكن عليك أولا إختيار بلدك 😅\nإذن... ماهو بلدك ؟ 👇🏻",
            quick_replies: [
              botly.createQuickReply("الجزائر 🇩🇿", "dz"),
              botly.createQuickReply("المغرب 🇲🇦", "ma"),
              botly.createQuickReply("سوريا 🇸🇾", "sy"),
              botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
              botly.createQuickReply("السودان 🇸🇩", "sd"),
              botly.createQuickReply("مصر 🇪🇬", "eg"),
              botly.createQuickReply("المزيد", "more"),
            ],
          });
        });
       }
    } else if (postback == "Profile") {
      if (user[0].mode == "free") {
        botly.sendButtons({
          id: senderId,
          text: `البلد الحالي 🌐 : ${user[0].country}\nنوع الحساب 💬 : ${user[0].mode}\nعمليات البحث 🔍 : (${user[0].searchnums}/10)`,
          buttons: [botly.createPostbackButton("تغيير البلد 🌐", "recountry")],
        });
      } else if (user[0].mode == "paid") {
        botly.sendButtons({
          id: senderId,
          text: `البلد الحالي 🌐 : ${user[0].country}\nنوع الحساب 💬 : ${user[0].mode}`,
          buttons: [
            botly.createPostbackButton("تغيير البلد 🌐", "recountry"),
            botly.createPostbackButton("حذف حسابي ❎", "delaccount"),
          ],
        });
      }
    } else if (postback == "Downgrade") {
      await updateUser(senderId, {token: null, smsed: false, mode: "free"})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({id: senderId, text: "تم إنهاء حسابك الموثق ☑️\nانت الان في الوضع المجاني. شكرا لتجربة كالربوت 💜"});
          });
    } else if (postback == "ToPay") {
      await updateUser(senderId, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: "sms"})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({id: senderId, text: "نجاح ✅ تم حفظ حسابك 👤\nيرجى كتابة رقم هاتف لتبدأ عملية التوثيق 📞."});
          });
    } else if (postback == "RePhone") {

      botly.sendText({id: senderId, text: "حسنا 🆗 يرجى إدخال رقم هاتف اخر الان 🤔"});

    } else if (postback == "ReCountry") {
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
          botly.createQuickReply("المزيد", "more"),
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
    } else if (message.postback.title == "5") {
      //
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
          botly.createQuickReply("اليمن 🇾🇪", "ye")
        ],
      });
    } else if (postback.length == 2) {
      for (const country of countries.countries) {
        if (postback === country.code) {
          await updateUser(senderId, {mode: "free", country: postback, phonecode: country.phonecode})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "نجاح ✅\nتم إختيار بلدك 💜\nيمكنك البحث عن 10 ارقام الهواتف يوميا أو التسجيل برقم الهاتف 📱",
            });
          });
          break;
        }
      }
    } else if (postback == "3") {
      //
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
    } else if (message.message.text == "5") {
      //
    }
  }
});

app.listen(3000, () => {
    console.log('App is on port : 3000');
});
