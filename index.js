'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const config = require('./config.json');
const Crawler = require('crawler');
const _ = require('lodash');
const moment = require('moment')


const crawler = new Crawler();

// create LINE SDK client
const client = new line.Client(config);

const app = express();

// webhook callback
app.post('/webhook', line.middleware(config), (req, res) => {
  try{
  // req.body.events should be an array of events
  if (!Array.isArray(req.body.events)) {
    return res.status(500).end();
  }
  // handle events separately
  Promise.all(req.body.events.map(event => {
    console.log('event', event);
    // check verify webhook event
    if (event.replyToken === '00000000000000000000000000000000' ||
      event.replyToken === 'ffffffffffffffffffffffffffffffff') {
      return;
    }
    return handleEvent(event);
  }))
    .then(() => res.end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
  }catch(err){
    console.log('err is', err)
  }
});

const replyListCinema = (token) => {
  crawler.queue([{
    uri: 'http://www.majorcineplex.com/movie',
    callback: function (error, res, done) {
      if(error){
          console.log(error);
      }else{
        try{
        let $ = res.$;
        let movieListObj = []
        $("#tabs-1 .interfacemovie").each((index, item) => {
          let getBuyLink = $(item).find('.blog-btnbuynow').attr('onclick').split('"')[1]
          let getDate = $(item).find('.releaseDate').text().trim().split(":")[1]
          let obj = {
            imgUrl: replaceHttps($(item).find('img').attr('src')),
            nameEn: $(item).find('.nameMovieEn').text().trim(),
            nameTh: $(item).find('.nameMovieTh').text().trim(),
            releaseDate: moment(getDate, 'DD/MM/YYYY').format('DD/MM/YYYY'),
            buyLinkButton: 'https://www.majorcineplex.com/movie'//replaceHttps(getBuyLink)
          }
          movieListObj.push(obj)
        })
        let sortingByDateDesc = _.orderBy(movieListObj, function(o) { return new Date(o.releaseDate); }, ['desc']);
        sortingByDateDesc.pop()
        let getBubble = createBubble(sortingByDateDesc)
        let getCarousel = createCarousel(sortingByDateDesc)
        return client.replyMessage(
          token,
          getCarousel
        ).catch((err) => {
          console.log('this is error ', Object.keys(err.originalError), err.originalError.response.data)
        })
        }catch(err){
          console.log('errrr is', err)
        }
      }
      done();
    }
  }])
}



// simple reply function
const replyText = (token, texts) => {
  texts = Array.isArray(texts) ? texts : [texts];
  return client.replyMessage(
    token,
    texts.map((text) => (
      [
        { 'type': 'text', text },
      ]
      ))
  );
}



// callback function to handle a single event
function handleEvent(event) {
  switch (event.type) {
    case 'message':
      const message = event.message;
      switch (message.type) {
        case 'text':
          return handleText(message, event.replyToken);
        case 'image':
          return handleImage(message, event.replyToken);
        case 'video':
          return handleVideo(message, event.replyToken);
        case 'audio':
          return handleAudio(message, event.replyToken);
        case 'location':
          return handleLocation(message, event.replyToken);
        case 'sticker':
          return handleSticker(message, event.replyToken);
        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }

    case 'follow':
      return replyText(event.replyToken, 'Got followed event');

    case 'unfollow':
      return console.log(`Unfollowed this bot: ${JSON.stringify(event)}`);

    case 'join':
      return replyText(event.replyToken, `Joined ${event.source.type}`);

    case 'leave':
      return console.log(`Left: ${JSON.stringify(event)}`);

    case 'postback':
      let data = event.postback.data;
      return replyText(event.replyToken, `Got postback: ${data}`);

    case 'beacon':
      const dm = `${Buffer.from(event.beacon.dm || '', 'hex').toString('utf8')}`;
      return replyText(event.replyToken, `${event.beacon.type} beacon hwid : ${event.beacon.hwid} with device message = ${dm}`);

    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }
}

function handleText(message, replyToken) {
  switch(message.text){
    case 'หนัง':
    return replyListCinema(replyToken)
    default :
    return replyText(replyToken, message.text);
  }
  
}

function handleImage(message, replyToken) {
  return replyText(replyToken, 'Got Image');
}

function handleVideo(message, replyToken) {
  return replyText(replyToken, 'Got Video');
}

function handleAudio(message, replyToken) {
  return replyText(replyToken, 'Got Audio');
}

function handleLocation(message, replyToken) {
  return replyText(replyToken, 'Got Location');
}

function handleSticker(message, replyToken) {
  return replyText(replyToken, 'Got Sticker');
}

//## Generator ##//

function createCarousel(movieList){
  let arrObj = []
  for(let [index, item] of movieList.entries()){
    console.log(index, item)
    let obj = {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": item.nameEn
          }
        ]
      },
      "hero": {
        "type": "image",
        "url": item.imgUrl,
        "size": "full",
        "aspectMode": "cover"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": 'วันที่เข้าฉาย'+ item.releaseDate
          },
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "style": "secondary",
            "action": {
              "type": "uri",
              "label": "Buy Ticket",
              "uri": item.buyLinkButton
            }
          }
        ]
      }
    }
    arrObj.push(obj)
    if(index === 9) {
      return {
        "type": "flex",
        "altText": "This is a Flex message",
        "contents": {
          "type": "carousel",
          "contents": arrObj
        }
      }
    }
  }
}


function createBubble(movieList){
  let arrObj = []
  for(let item of movieList){
    let obj = {
      'type': 'box',
      'layout': 'vertical',
      'contents': [
        {
          'type': 'image',
          'url': item.imgUrl,
          "size": "full",
        },
        {
          'type': 'box',
          'layout': 'vertical',
          'contents': [
            {
              'type': 'text',
              'text': 'เรื่อง: '+item.nameEn
            },
            {
              'type': 'text',
              'text':'วันที่เข้าฉาย: '+ item.releaseDate,
              'wrap': true
            },
            // {
            //   "type": "button",
            //   "style": "primary",
            //   "height": "sm",
            //   "action": {
            //    "type": "uri",
            //    "label": "Buy Ticket",
            //    "uri": item.buyLinkButton
            //   }
            // }
          ]
        },
      ],
    }
    arrObj.push(obj)
  }

  return {
      'type': 'flex',
      'altText': 'รายการหนังของ Major',
      'margin': 'none',
      'contents': {
        'type': 'bubble',
        'header': {
          'type': 'box',
          'layout': 'vertical',
          'contents': [
            {
              'type': 'text',
              'text': 'รายการหนัง Major',
              "size": "md",
              "align": "center",
              "color": "#ffffff"
            },
          ],
        },
        'body': {
          'type': 'box',
          'layout': 'vertical',
          'spacing': 'md',
          'contents': arrObj,
        },
        'styles': {
          'header': {
            'backgroundColor': '#3742fa',
          },
        },
    }
  }
}
//## Generator ##//






//###### UTILITY FUNCTION #######//
function replaceHttps(data){
  return data ? data.replace(/^http:\/\//i, 'https://') : '' 
}

//###### UTILITY FUNCTION #######//

const port = config.port;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
