const Botly = require("botly");
const axios = require("axios");
const botly = new Botly({
  accessToken: process.env.PAGE_ACCESS_TOKEN,
  verifyToken: process.env.VERIFY_TOKEN,
  webHookPath: process.env.WB_PATH,
  notificationType: Botly.CONST.REGULAR,
  FB_URL: "https://graph.facebook.com/v2.6/",
});
/* ----- DB ----- */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY, { auth: { persistSession: false} });
const truebase = createClient(process.env.TB_URL, process.env.TB_KEY, { auth: { persistSession: false} });
/* ----- DB ----- */

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

async function getTokens() {
  const { data, error } = await supabase
  .from('users')
  .select('*')
  .neq("token", null)
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

const searchFree = async (senderId, country, query, code) => {
  var callapp = (qr) => {
    if (qr.startsWith("+")) {
      qr = qr.slice(1);
      return qr.replace(/\D/g, '');
    } else {
      return code + qr.replace(/\D/g, '');
    }
  };
  
  var tokens = await getTokens();
  var random = Math.floor(Math.random() * tokens.length);
  var research = function (token, key) {
    axios.get(`https://search5-noneu.truecaller.com/v2/bulk?q=${query}&countryCode=${country}&type=14&encoding=json`, {
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
        })
      .then((response) => {
          if (response.data.data[0]) {
            if (response.data.data[0].value.name) {
              botly.sendGeneric({
                id: senderId,
                elements: {
                  title: response.data.data[0].value.name,
                  image_url: "https://i.ibb.co/VTXKnYJ/gardencallerbot.png",
                  subtitle: `${response.data.data[0].value.phones[0].carrier} | ${response.data.data[0].value.phones[0].nationalFormat}`,
                  buttons: [
                    botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                    botly.createPostbackButton("تسجيل برقم الهاتف 📱", "paid"),
                  ],
                },
                aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
              }, async () => {
                await createTrue({phone: response.data.data[0].value.phones[0].e164Format, name: response.data.data[0].value.name, gender: response.data.data[0].value.gender || "None"})
              .then((data, error) => {
                console.log("True Pushed")
              });
              });
            } else {
              axios.get(`https://s.callapp.com/callapp-server/contactsearch?cpn=%2B${callapp(query)}&myp=gp.110753710857627974073&tk=0012255940`)
              .then(response => {
                console.log("fincp")
                botly.sendGeneric({
                  id: senderId,
                  elements: {
                    title: response.data.name,
                    image_url: "https://i.ibb.co/VTXKnYJ/gardencallerbot.png",
                    subtitle: `TBS | NDN`,
                    buttons: [
                      botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                      botly.createPostbackButton("تسجيل برقم الهاتف 📱", "paid"),
                    ],
                  },
                  aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
                });
              }, error => {
                botly.sendText({
                  id: senderId,
                  text: "لم يتم العثور على صاحب 👤 هذا الرقم 🙄",
                });
              });
            }
          } else {
            axios.get(`https://s.callapp.com/callapp-server/contactsearch?cpn=%2B${callapp(query)}&myp=gp.110753710857627974073&tk=0012255940`)
              .then(response => {
                console.log("fincp")
                botly.sendGeneric({
                  id: senderId,
                  elements: {
                    title: response.data.name,
                    image_url: "https://i.ibb.co/VTXKnYJ/gardencallerbot.png",
                    subtitle: `TBS | NDN`,
                    buttons: [
                      botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                      botly.createPostbackButton("تسجيل برقم الهاتف 📱", "paid"),
                    ],
                  },
                  aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
                });
              }, error => {
                botly.sendText({
                  id: senderId,
                  text: "لم يتم العثور على صاحب 👤 هذا الرقم 🙄",
                });
              });
          }
        },
        async (error) => {
          const retry = async () => {
            var retokens = await getTokens();
            var rerandom = Math.floor(Math.random() * retokens.length);
            research(retokens[rerandom].token, retokens[rerandom].uid);
          };
          if (error.response.data.status == 40101) {
            await updateUser(key, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: "free"})
                  .then((data, error) => {
                    if (error) {
                      console.log("DB-ERR : ", error);
                    }
                    console.log("DB-CLN");
                    retry();
                  });
          } else if (error.response.data.status == 42601) {
            await updateUser(key, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: "free"})
                  .then((data, error) => {
                    if (error) {
                      console.log("DB-ERR : ", error);
                    }
                    console.log("UP-CLN");
                    retry();
                  });
          } else {
            retry();
          }
        });
      };
      research(tokens[random].token, tokens[random].uid);
};


const searchPaid = async (senderId, country, query, code, token) => {
  var callapp = (qr) => {
    if (qr.startsWith("+")) {
      qr = qr.slice(1);
      return qr.replace(/\D/g, '');
    } else {
      return code + qr.replace(/\D/g, '');
    }
  };

  try {
    const response = await axios.get(`https://search5-noneu.truecaller.com/v2/search?q=${query}&countryCode=${country}&type=4&encoding=json`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    }});
    if (response.data.data[0] != null) {
      if (response.data.data[0].name) {
        if (response.data.data[0].image) {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: response.data.data[0].name,
              image_url: response.data.data[0].image,
              subtitle: `${response.data.data[0].phones[0].carrier} | ${response.data.data[0].phones[0].nationalFormat}`,
              buttons: [
                botly.createWebURLButton("WhatsApp 📞",`wa.me/${response.data.data[0].phones[0].e164Format}`),
                botly.createPostbackButton("الإعدادات ⚙️", "profile")
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.SQUARE,
          }, async () => {
            await createTrue({phone: response.data.data[0].phones[0].e164Format, name: response.data.data[0].name, gender: response.data.data[0].gender || "None"})
          .then((data, error) => {
            console.log("True Pushed")
          });
          });
        } else {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: response.data.data[0].name,
              image_url: "https://i.ibb.co/StcT5v2/unphoto.jpg",
              subtitle: `${response.data.data[0].phones[0].carrier} | ${response.data.data[0].phones[0].nationalFormat}`,
              buttons: [
                botly.createWebURLButton("WhatsApp 📞", `wa.me/${response.data.data[0].phones[0].e164Format}`),
                botly.createPostbackButton("الإعدادات ⚙️", "profile"),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.SQUARE,
          }, async () => {
            await createTrue({phone: response.data.data[0].phones[0].e164Format, name: response.data.data[0].name, gender: response.data.data[0].gender || "None"})
          .then((data, error) => {
            console.log("True Pushed")
          });
          });
        }
      } else {
        axios.get(`https://s.callapp.com/callapp-server/contactsearch?cpn=%2B${callapp(query)}&myp=gp.110753710857627974073&tk=0012255940`)
        .then(response => {
          console.log("fincp")
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: response.data.name,
              image_url: "https://i.ibb.co/StcT5v2/unphoto.jpg",
              subtitle: `TBS | NDN`,
              buttons: [
                botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                botly.createPostbackButton("تسجيل برقم الهاتف 📱", "paid"),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
          });
        }, error => {
          botly.sendText({
            id: senderId,
            text: "لم يتم العثور على صاحب 👤 هذا الرقم 🙄",
          });
        });
      }
    } else {
      botly.sendText({id: senderId, text: "لم يتم العثور على صاحب 👤 هذا الرقم 🙄"});
    }
  } catch (error) {
    if (error.response.data.status == 40101) {
      await updateUser(senderId, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: "free"})
              .then((data, error) => {
                if (error) {
                  console.log("DB-ERR : ", error);
                }
                console.log("PAID-CLN");
                botly.sendText({ id: senderId, text: "تم إنهاء حسابك. المرجو استعمال رقم اخر. او الإكتفاء بالوضع المجاني" });
              });
    } else if (error.response.data.status == 42601) {
      await updateUser(senderId, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: "free"})
              .then((data, error) => {
                if (error) {
                  console.log("DB-ERR : ", error);
                }
                console.log("PAID-CLN");
                botly.sendText({ id: senderId, text: "الرقم الذي سجلت به يتطلب تحقق الرجاء فتح تطبيق تروكالر و إجراء التحقق أو استعمل رقم أخر. تم وضع حسابك في الوضع المجاني" });
              });
    }
  }
};
exports.searchPaid = searchPaid;
exports.searchFree = searchFree;