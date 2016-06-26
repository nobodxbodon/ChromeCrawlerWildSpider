// MIT License

function preprocess(links) {
  var processed = [];
  for (var i=0; i<links.length; i++) {
    var link = links[i];
    var title = link.title;
    var url = link.url;
    if (title) {
      title = title.trim();
    }
    // add document.documentURI if url is relative
    var currentUri = document.documentURI;
    var domain = document.location.hostname;
    var domainUri = currentUri.substring(0, currentUri.indexOf(domain) + domain.length);
    if (url) {
      // 绝对url
      if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
      // 不处理url
      }
      // 相对domain
      else if (url.indexOf('/') == 0) {
        url = domainUri + url;
      }
      // 相对当前url
      else {
        url = currentUri + url;
      }
    }
    processed.push({title: title, url: url})
  };
  return processed;
}

function isValid(link) {
  var linkUri = link.url;

  if (
    linkUri == null || linkUri == ''
    // exclude the bookmark on the same page
    || getUriFromBookmark(linkUri) == getUriFromBookmark(document.documentURI)
    // exclude link with empty title
    || link.title == null || link.title == ''
    // exclude javascript resource
    || linkUri.indexOf('javascript:')>-1) {
    
    return false;
  }
  return true;
}

// get root page from bookmark url
function getUriFromBookmark(url) {
  var index = url.indexOf('#');
  return index > 0
    ? url.substring(0, index)
    : url;
}

/* Node format:
 attribs: object
 children: Array
 next: object
 parent: object
 prev: object
 type: string
 */
function getLinksInDomNode(node) {
  var links = [];
  if (node.type === 'tag') {
    if (node.name !== 'a') {
      Array.prototype.push.apply(links, getAllLinksInDomTree(node.children));
    } else {
      link = extractLink(node);
      //console.log(link);
      links.push(link);
    }
  }
  return links;
}

function extractLink(node) {
  //console.log(node.text);
  var children = node.children;
  if (children.length == 1 && children[0].type === 'text') {
    return {title: children[0].data, url: node.attribs.href};
  } else {
    // if children has 'span' or 'img' tag, extract text from them
    return {title: tryExtractTextFromChildren(children), url: node.attribs.href}; 
  }
}

function tryExtractTextFromChild(node) {
  if (node.type === 'text') {
    return node.data;
  } else if (node.name === 'span' && node.type === 'tag') {
    // get the text child
    if (node.children.length === 1) {
      var child = node.children[0];
      return tryExtractTextFromChild(child);
    }
  } else if (node.name === 'img' && node.type === 'tag') {
    return node.attribs.alt;
  } else if (node.name === 'strong' && node.type === 'tag') {
    var innerHTML = '<strong>' + tryExtractTextFromChildren(node.children) + '</strong>';
    return innerHTML;
  }
  return null;
}

function tryExtractTextFromChildren(nodes) {
  var text = "";
  for(var i = 0; i < nodes.length; i++) {
    var childText = tryExtractTextFromChild(nodes[i]);
    if (childText) {
      text += childText;
    }
  }
  return text;
}

/* dom tree sample:
 [{
    data: 'Xyz ',
    type: 'text'
}, {
    type: 'script',
    name: 'script',
    attribs: {
        language: 'javascript'
    },
    children: [{
        data: 'var foo = \'<bar>\';<',
        type: 'text'
    }]
}, {
    data: '<!-- Waah! -- ',
    type: 'comment'
}]
https://github.com/fb55/domhandler
*/
// recursively walk through dom tree to get all link
function getAllLinksInDomTree(dom) {
  var links = [];
  for(var i = 0; i < dom.length; i++) {
    Array.prototype.push.apply(links, getLinksInDomNode(dom[i]));
  }
  return links;
}

var htmlparser = require("htmlparser2");

function getAllLinksOnPage(htmlContent) {
  var links = [];
  
  // TODO: 是否可以用parser解决(类似text)
  var handler = new htmlparser.DomHandler(function (error, dom) {
    if (error)
      console.log(error);
    else {
      links = getAllLinksInDomTree(dom);
      links = preprocess(links);
      links = links.filter(isValid);
    }
  });
  
  var parser = new htmlparser.Parser(handler);
  parser.write(htmlContent);
  parser.end();
  
  return links;
}

function 提取文本(htmlContent) {
  var 忽略内容TAG = ['script', 'style', 'noscript'];
  var 文本 = [];
  var 为文本 = true;
  
  var textParser = new htmlparser.Parser({
    ontext: function(text){
      // 删除空白文本
      if (为文本 && text && text.trim() !== '') {
        文本.push(text);
      }
    },
    onopentag: function(tag名, attribs){
      // TODO: no checking type of script - && (attribs.type === "text/javascript" || (attribs.language && attribs.language.toLowerCase() === 'javascript'))
      if(忽略内容TAG.indexOf(tag名) !== -1){
        为文本 = false;
      }
    },
    onclosetag: function(tag名){
      if(忽略内容TAG.indexOf(tag名) !== -1){
        为文本 = true;
      }
    }
  }, {decodeEntities: true});
  
  textParser.write(htmlContent);
  textParser.end();

  return 文本.join(' ');
}

function fastGetLinks() {
  var aElements = document.getElementsByTagName('a');
  var links = [];
  for(var i=0;i<aElements.length;i++){
    links.push({title:aElements[i].text, url:aElements[i].href});
  }
  return links;
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  //var t = new Date();
  
  var htmlContent = document.documentElement.innerHTML;
  //console.log((new Date() - t) + " ms" + ' get inner html');
  //t = new Date();
  
  var linksOnPage = getAllLinksOnPage(htmlContent);//fastGetLinks();
  // document.getElementsByTagName('a') would save a bit time, but doesn't improve page/sec much
  //console.log((new Date() - t) + " ms" + ' get alllinks');
  //t = new Date();
  
  chrome.runtime.sendMessage({
    links: linksOnPage,
    tabId: msg.tabId,
    extraction:
      {
        title: document.title,
        url: document.URL,
        content: 提取文本(htmlContent)
        // change to document.documentElement.innerText also doesn't improve page/sec much
      }
  });
  
  //console.log((new Date() - t) + " ms" + " End of extracting tab: " + msg.tabId + " with " + linksOnPage.length + " urls on page");
});
