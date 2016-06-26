
// 允许使用多tab并行crawl, 类似thread pool
var 最多url数 = 10;
var tab总数 = 3;

var 待访问链接 = [];
var 已访问链接 = [];
var url集合 = {};

var 当前tab = 0;
// 管理tab的空闲/繁忙状态
var 使用tab = {};
var 当前时间 = new Date();
var 第一个tabId;
var 第一个tab加载开始;

var db = new Dexie('WildSpider');

var 重置计数 = function() {
  待访问链接 = [];
  已访问链接 = [];
  url集合 = {};
  
  当前tab = 0;
  使用tab = {};
  
  当前时间 = new Date();
}

// 链接表为需要打开的链接列表, 链接格式为{title, url};
// 若tabId为空,直接用所有可用的新tab打开
var 载入链接 = function(链接表, tabId) {
  if (链接表) {
    for (var i = 0; i < 链接表.length; i++) {
      if (!url集合[链接表[i].url]) {
        待访问链接.push(链接表[i]);
        url集合[链接表[i].url] = true;
      }
    }
  }
  if (!待访问链接 || 待访问链接.length == 0) {
    return;
  }

  if (tabId) {
    var 下一个链接 = 待访问链接.splice(0, 1)[0].url;
    if (已访问链接.length < 最多url数) {
      if (tabId == 第一个tabId) {
        console.log((new Date() - 第一个tab加载开始) + ' ms to analyze');
        第一个tab加载开始 = new Date();
      }
      chrome.tabs.update(
        tabId,
        {
          url: 下一个链接,
          selected: false
        },
        function(tab) {
        }
      );
      已访问链接.push(下一个链接);
    }
  }

  // 如果不到tab总数, 每个新url将在新tab中打开
  while(当前tab < tab总数) {
    if (!待访问链接 || 待访问链接.length == 0) {
      break;
    }
    var 下一链接 = 待访问链接.splice(0, 1)[0].url;
    if (已访问链接.length < 最多url数) {
      chrome.tabs.create({
        url: 下一链接,
        selected: false
      }, function(tab) {
        if (!第一个tabId) {
          第一个tab加载开始 = new Date();
          第一个tabId = tab.id;
        }
        使用tab[tab.id] = true;
      });
      已访问链接.push(下一链接);
    }
    当前tab++;
  }
}

// Define a schema
db.version(1)
	.stores({
		places: '++id, url, title, content, last_visit_date'
});

// Add hooks that will index "title" for full-text search:
db.places.hook("creating", function (primKey, obj, trans) {
  obj.last_visit_date = Date.now();
});

// Open the database
db.open().catch(function(error){
		alert('Uh oh : ' + error);
});

chrome.browserAction.onClicked.addListener(function(tab) {
  重置计数();
  
  var 当前Url = tab.url;
  载入链接([{title: tab.titie, url: 当前Url}], null);
});

// 确保只在页面完全加载时触发一次
// TODO: 页面可能卡在某个资源上不能加载完成. 添加重试与超时,允许跳过
// 超时思路: update/create时开始定时,若onComplete不重置,则关掉tab
chrome.webNavigation.onCompleted.addListener(function(details) {
  if (使用tab[details.tabId]) {
    chrome.tabs.get(details.tabId, function(tab) {
      if(tab.url === details.url) {
        if (details.tabId == 第一个tabId) {
          console.log((new Date() - 第一个tab加载开始) + ' ms to load');
          第一个tab加载开始 = new Date();
        }
        // 确认tab是本扩展打开的. TODO: 如果用户在这个tab打开新url,也将会被解析. 是否合理?
        chrome.tabs.sendMessage(details.tabId, {tabId: details.tabId});
        //console.log('onComplete in tab: ' + details.tabId + ' url: ' + details.url);
      }
    });
  }
});

chrome.runtime.onMessage.addListener(function (request, _, sendResponse) {
  // To view background log, go to chrome://extensions/ and click on that inspect view under the extension.
  var 提取链接 = request.links;
  var tabId = request.tabId;
  var 提取内容 = request.extraction;
  //console.log(提取内容)
  db.places.add(提取内容);
  
  if (已访问链接.length % 10 === 0) {
    console.log((new Date() - 当前时间)/1000 + " sec" + " to crawl " + 已访问链接.length + ' pages');// 待访问链接数:' + 待访问链接.length);//提取内容.title + ' url:' + 提取内容.url + ' 长度: ' + 提取内容.content.length);
  }
  
  载入链接(提取链接, tabId);
});
