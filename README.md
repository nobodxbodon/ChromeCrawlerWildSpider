Chrome extension in webstore: https://chrome.google.com/webstore/detail/wild-spider/aanpchnfojihjddlocpgoekffmjkhbbe

#WATCH OUT: more tabs you use, more computer resources (CPU, memory) will be used, and each page costs a bit disk (in IndexedDB, accessible from Chrome Extensions -> Wild Spider, Inspect views: background page)to save the content.

The "spider" works in this way:
- 1) The current url is used as the starting point, and it's loaded again in a new tab.
- 2) After this page is loaded, fetch all the links on the page.
- 3) Get all the links on the page, including relative urls.
- 4) Save the text content of the page. Open the extracted link parallelly in all the tabs used (by default 3, set in eventPage).
- 5) repeat 2-4
