// 会话相关逻辑
$(document).ready(function () {

    //const
    const CREATE_SESSION = 220;
    //当前正通信的chatter
    var activeChatter;

    //当前通信使用的session
    var activeSession;

    var chatterListDoms = document.getElementsByClassName("contact");

    // 提醒窗，一个用户只提醒一次
    var alertMap = new Map();

    var $chat = $(".chat");

    // 聊天框dom
    var $messageBox = $(".chat__messages")[0]

    // 消息模态框
    var $viewContent = $("#viewContent")
    var $messageViewModel = $("#message-view-modal")

    // 流map
    var streamMessageMap = new Map()
    queryStreamDom = function(sessionId) {
        return streamMessageMap.get(sessionId)
    }

    function selectMessageDom(message, isMain) {
        var dom;
        if (message.content) {
            // 如果是群聊message
            if (message.common) {
                dom = commonMessageDom(message, isMain, getChatterMap().get(message.chatterId));
            }
            // 单聊message
            else {
                dom = messageDom(message, isMain);
            }
        } else {
            // 如果是群聊message
            if (message.common) {
                dom = commonFileDom(message, isMain, isMain, "ready", "/chat/" + message.url, "/chat/" + message.snapshotUrl, getChatterMap().get(message.chatterId));
            }
            // 单聊message
            else {
                dom = fileDom(message, isMain, isMain, "ready", "/chat/" + message.url, "/chat/" + message.snapshotUrl);
            }
        }
        return dom;
    }

    addSessionListener = function (chatterListData) {
        console.log("添加了监听器");
        for (var i = 0; i < chatterListDoms.length; i++) {
            var dom = chatterListDoms[i];
            dom.index = i;
            dom.addEventListener("click", function () {
                if (window.uploadLock) {
                    return
                }
                //获取当前chatter
                activeChatter = chatterListData[this.index];
                console.log("activeChatter", activeChatter);
                // 设置签名
                var sign = cutStrByByte(activeChatter.signature, 28);
                $(".chat__status").text(sign);
                //判断是否为掉线状态
                if (activeChatter.status == 0) {
                    showToast("对方网络异常", 1500)
                }
                // 判断是否为离线状态
                // if (activeChatter.status == -1){
                //     showToast("对方下线了", 1000)
                // }
                //获取session
                var socket = getSocket();
                var action = new Object();
                action.code = CREATE_SESSION;
                action.msg = "ok";
                action.data = getChatterId() + ";" + activeChatter.id;
                //向服务器发送数据
                socket.send(JSON.stringify(action));
                // 设置成未提醒
                setAlertMap(activeChatter.id, false);
                //设置消息已读
                changeStatus(activeChatter.id, false);
                // 设置工具栏
                loadMiniTool(activeChatter)
            });
        }
    }

    $(".chat__back").on("click", function () {
        if (window.uploadLock) {
            return
        }
        activeChatter = null;
        activeSession = null;
    });

    //创建session,socket回调
    createSession = function (session) {
        activeSession = session;
        //初始化消息
        //清除dom
        $(".chat__msgRow").remove();
        $(".time").remove();
        var messageList = activeSession.messageList;
        for (var i = 0; i < messageList.length; i++) {
            var message = messageList[i];
            var content = message.content;
            var isMain;
            if (message.chatterId == getChatterId()) {
                isMain = true;
            } else {
                isMain = false;
            }
            // 根据消息与ismain创建dom
            var dom = selectMessageDom(message, isMain);

            //dom中添加消息
            $messageBox.append(dom);
        }

        // 如果存在stream消息，也要添加到messageBox中
        var streamMessageDom = streamMessageMap.get(activeSession.sessionId)
        if (streamMessageDom) {
            $messageBox.append(streamMessageDom);
            $(streamMessageDom.mainDocChild).on('click', () => {
                $viewContent[0].triggerMessageId = streamMessageDom.messageId
                $viewContent[0].innerHTML = buildHighlightContent(streamMessageDom.mainDocChild.innerText)
                addCopyButtonToPre($viewContent[0])
                $messageViewModel.modal('open')
            })
        }

        var imgDivArr = document.querySelectorAll("#imgready")
        for (var i = 0; i < imgDivArr.length; i++) {
            var img = imgDivArr[i];
            if (img.complete) {
                continue
            }
            $(img).addClass("imgFileTemp")
            img.onload = function () {
                console.log("onload");
                $(this).removeClass("imgFileTemp")
            };
        }

        scrollToChatContainerBottom(isSideBarOutside() ? 100 : 1000)
        timeoutId = setTimeout(() => {
            if (activeSession) {
                activeSession.scrollComplete = true
            }
        }, 1500)
    }


    //收到消息，回调
    receiveStreamMessage = function (message) {
        var dom = streamMessageMap.get(message.sessionId)
        const end = message.end

        //如果是当前session
        if (activeChatter && message.chatterId == activeChatter.id && activeSession.scrollComplete) {
            // 通过map，找到dom，并将文案append到对应的dom上
            if (!dom) {
                const cachedMsg = streamMessageMap.get("cache_" + message.sessionId)
                if (cachedMsg) {
                    streamMessageMap.delete("cache_" + message.sessionId)
                    cachedMsg.content = cachedMsg.content + message.content
                    message = cachedMsg
                }
                dom = messageDom(message, false)
                $(dom.mainDocChild).on('click', () => {
                    $viewContent[0].triggerMessageId = dom.messageId
                    $viewContent[0].innerHTML = buildHighlightContent(dom.mainDocChild.innerText)
                    addCopyButtonToPre($viewContent[0])
                    $messageViewModel.modal('open')
                })
                streamMessageMap.set(message.sessionId, dom)
                $messageBox.append(dom);
            } else {
                const cachedMsg = streamMessageMap.get("cache_" + message.sessionId)
                if (cachedMsg) {
                    streamMessageMap.delete("cache_" + message.sessionId)
                    message.content = cachedMsg.content + message.content
                }
                dom.mainDocChild.innerText = dom.mainDocChild.innerText + message.content
                if ($messageViewModel[0].className.indexOf('open') != -1 || end) {
                    if ($viewContent[0].triggerMessageId === dom.messageId) {
                        $viewContent[0].innerHTML = buildHighlightContent(dom.mainDocChild.innerText)
                        addCopyButtonToPre($viewContent[0])
                        scrollToMessageViewBottom(100)
                    }
                }
                if (activeSession.scrollComplete) {
                    scrollToChatContainerBottom(100)
                }
            }

            if (end) {
                streamMessageMap.delete(message.sessionId)
                streamMessageMap.delete("cache_" + message.sessionId)
                scrollToChatContainerBottom(100)
                // 判断是不是当前页
                if (!isCurrentPage) {
                    document.getElementsByTagName("title")[0].innerText = "molachat(当前有未读消息)";
                }
                // 消息通知
                notifyNewMessage(message)
            }
        }
        // 非当前session，只处理结束场景
        else if (end){
            streamMessageMap.delete(message.sessionId)
            streamMessageMap.delete("cache_" + message.sessionId)

            var senderId = message.chatterId;
            // 这个信息必须不是公共信息
            if (!message.common && senderId != getChatterId()) {
                changeStatus(senderId, true);
            }
            // 页面提醒
            if (message.chatterId != getChatterId() && activeChatter != null && message.chatterId != activeChatter.id && $chat.css("display") === "block") {
                if (!alertMap.get(message.chatterId) && !message.common) {
                    // 群消息免提醒
                    showToast("外部有新的消息", 1000)
                }
                // 设置成已经提醒
                setAlertMap(message.chatterId, true);
            }

            // 消息通知，需要拿到整体的消息
            notifyNewMessage(message)
        } else {
            const cachedMsg = streamMessageMap.get("cache_" + message.sessionId)
            if (!cachedMsg) {
                streamMessageMap.set("cache_" + message.sessionId, message)
            } else {
                cachedMsg.content = cachedMsg.content + message.content
            }
        }

    }

    //收到消息，回调
    receiveMessage = function (message) {
        console.info(message)
        // 如果message是群聊message且群聊信息窗打开
        if (message.common) {
            if (activeChatter && activeChatter.id === "temp-chatter") {
                // 判断是否是自己的消息
                if (message.chatterId === getChatterId()) {
                    // 判断是否是文件
                    if (!message.content) {
                        // 更新文件的url
                        for (let dom of $(".notMine")) {
                            dom = dom.querySelectorAll("a")
                            let a1 = dom[0]
                            let a2 = dom[1]
                            // 非图片
                            if (!(a1 || a2)) {
                                continue
                            }
                            innerText = a2.innerText.replace(/\s+/g, "");
                            if (a2.innerText === message.fileName && a2.href === "javascript:;") {
                                a2.href = getPrefix() + "/chat/" + message.url
                                // 更新图片文件的显示
                                let fileImg = a1.querySelector("img")
                                if (fileImg && isImg(a2.href)) {
                                    // 更新为图片的snapshot
                                    fileImg.src = getPrefix() + "/chat/" + message.snapshotUrl
                                    $(fileImg).css("width", "100%");
                                    $(fileImg).on('click', function () {
                                        syncToHolder(fileImg.src)
                                    })
                                    fileImg.onload = function () {
                                        console.log("上传的图片加载完成common");
                                        scrollToChatContainerBottom(100)
                                    }
                                }
                                a2.target = "_blank";
                            }
                        }

                    }
                    return
                }
                // 根据消息与ismain创建dom
                var dom = selectMessageDom(message, false);

                $messageBox.append(dom);

                scrollToChatContainerBottom(100)

                // 判断是不是当前页
                if (!isCurrentPage) {
                    document.getElementsByTagName("title")[0].innerText = "molachat(当前有未读消息)";
                }
                return
            }
            // 收到common的消息，非群聊页面中，直接丢弃
            return
        }

        // 如果是自己的文件消息
        if (message.chatterId === getChatterId() && !message.content) {
            // 更新文件的url
            for (let dom of $(".notMine")) {
                dom = dom.querySelectorAll("a")
                let a1 = dom[0]
                let a2 = dom[1]
                // 非图片
                if (!(a1 || a2)) {
                    continue
                }
                innerText = a2.innerText.replace(/\s+/g, "");
                if (a2.innerText === message.fileName && a2.href === "javascript:;") {
                    a2.href = getPrefix() + "/chat/" + message.url
                    // 更新图片文件的显示
                    let fileImg = a1.querySelector("img")
                    if (fileImg && isImg(a2.href)) {
                        // 更新为图片的snapshot
                        fileImg.src = getPrefix() + "/chat/" + message.snapshotUrl
                        $(fileImg).css("width", "100%");
                        $(fileImg).on('click', function () {
                            syncToHolder(fileImg.src)
                        })
                        fileImg.onload = function () {
                            console.log("上传的图片加载完成");
                            scrollToChatContainerBottom(100)
                        }
                    }
                    a2.target = "_blank";
                }
            }
        }

        //如果是当前session,立即加载到dom中
        if (activeChatter != null && message.chatterId == activeChatter.id) {
            //dom中添加消息
            //如果为文件传输
            var dom;
            if (message.content != null) {
                dom = messageDom(message, false);
            } else {
                dom = fileDom(message, false, false, "ready", "/chat/" + message.url, "/chat/" + message.snapshotUrl);
            }

            $messageBox.append(dom);
            scrollToChatContainerBottom(100)
            // 判断是不是当前页
            if (!isCurrentPage) {
                document.getElementsByTagName("title")[0].innerText = "molachat(当前有未读消息)";
            }
            // 消息通知
            notifyNewMessage(message)
        }
        //如过非当前session，将对应chatter的未读消息提示点亮
        else {
            var senderId = message.chatterId;
            // 这个信息必须不是公共信息
            if (!message.common && senderId != getChatterId()) {
                changeStatus(senderId, true);
            }
            // 提醒要求
            // 1.判断该信息不能是自己发的
            // 2.不能没有正在通话的session
            // 3.消息主人id不能是正在通话者的id
            // 4.聊天窗可见
            if (message.chatterId != getChatterId() && activeChatter != null && message.chatterId != activeChatter.id && $chat.css("display") === "block") {
                if (!alertMap.get(message.chatterId) && !message.common) {
                    // 群消息免提醒
                    showToast("外部有新的消息", 1000)
                }
                // 设置成已经提醒
                setAlertMap(message.chatterId, true);
            }

            // 消息通知
            notifyNewMessage(message)
        }
    }

    function notifyNewMessage(message) {
        // 消息通知
        let chatterMap = getChatterMap()
        if (chatterMap && chatterMap.get(message.chatterId)) {
            let chatterName = chatterMap.get(message.chatterId).name
            if (message.fileName && message.fileName !== '') {
                sendNotification(`${chatterName} 向你发送了文件`)
            } else if (message.content) {
                sendNotification(`${chatterName} 说 ${message.content}`)
            } else{
                sendNotification(`${chatterName} 向你发送了消息`)
            }
        } else {
            sendNotification("您有新的消息")
        }
    }

    getActiveSessionId = function () {
        return activeSession.sessionId;
    }

    getActiveChatter = function () {
        return activeChatter;
    }
    setActiveChatterName = function (name) {
        activeChatter.name = name;
        //更新dom
        $(".chat__name")[0].innerText = name;
        // 根据文本长度动态缩放文字
        let nameLength = getStringLength(name)
        if (nameLength > 20) {
            $(".chat__person").css("font-size", "1.55rem")
        } else {
            $(".chat__person").css("font-size", "2rem")
        }
    }
    setActiveChatter = function (chatter) {
        activeChatter = chatter;
    }

    setActiveChatterImgUrl = function (imgUrl) {
        activeChatter.imgUrl = imgUrl;
        $("img.cloned")[0].src = imgUrl;
    }

    setActiveChatterSign = function (sign) {
        activeChatter.signature = sign;
        sign = cutStrByByte(sign, 28);
        $(".chat__status")[0].innerText = sign;
    }

    setAlertMap = function (id, status) {
        alertMap.set(id, status)
    }
});