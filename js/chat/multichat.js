// 群聊逻辑
$(document).ready(function () {
    //const，创建session
    const CREATE_SESSION = 220;

    var $friend_list = $(".friend-list")[0];
    var $copyViewBtn = $('#copyViewBtn')
    var $viewContent = $("#viewContent")
    var $viewModal = $("#message-view-modal")

    $chatMsg = $(".chat__messages")[0];

    // 点击事件
    var menu = $("#menu")
    $(document).on('click', "#menu-icon", function (e) {
        openFAB(menu)
    })



    $(document).on('click', '#multichat', function (e) {
        // 群组的信息
        const groupInfo = {
            name: "大家随便聊聊",
            signature: "这里是MOLA的公共聊天室",
            sessionId: "common-session",
            imgUrl: "img/mola.png",
            hint: "已进入群聊会话，可以畅所欲言"
        }
        onStartGroupSession(groupInfo)
        // 设置工具栏
        loadMiniTool(getActiveChatter())
    });

    /**
     * 主方法，进入群聊会话
     * @param {*} groupInfo 
     */
    function onStartGroupSession(groupInfo) {
        enterMutiChat(groupInfo);
        closeFAB(menu)
        $('.tooltipped').tooltip('remove');
        showToast(groupInfo.hint, 1800)
    }

    // 进入群聊区域
    function enterMutiChat(groupInfo) {
        // 在好友区添加一个空白，然后点击
        var dom = chatterDom(
            groupInfo.name,
            groupInfo.imgUrl,
            false,
            "",
            "");
        dom.id = "mutichat-dom"

        $friend_list.append(dom)
        let $tempDom = $("#mutichat-dom");
        let photo = $(".contact__photo");

        // 头像过度动画
        photo.animate({
            opacity: 0
        }, 200)
        setTimeout(function () {
            $(".contact__photo").css({
                opacity: 1
            })
        }, 1000)
        $tempDom.click()
        $tempDom.remove()
        // 清空区域，初始化签名
        initMutiChat(groupInfo);
        // ui结束，切换会话
    }

    function initMutiChat(groupInfo) {
        //设置当前chatter为公共chatter
        var activeChatter = {
            createTime: 99999999,
            id: "temp-chatter",
            imgUrl: groupInfo.imgUrl,
            ip: "127.0.0.1",
            name: groupInfo.name,
            signature: groupInfo.signature,
            status: 1,
            isTemp: true
        };
        setActiveChatter(activeChatter);
        // 设置签名
        var sign = cutStrByByte(activeChatter.signature, 28);
        $(".chat__status").text(sign);
        //获取session
        var socket = getSocket();
        var action = new Object();
        action.code = CREATE_SESSION;
        action.msg = "ok";
        // 发送公共chatter的固定sessionId
        action.data = groupInfo.sessionId;
        //向服务器发送数据
        socket.send(JSON.stringify(action));
    }

    /**
     * dom区域 内容 、是否是自己、chatter
     */
    commonMessageDom = function (message, isMain, chatter) {
        // 时间dom
        let timeDoc = timeDom(message.createTime)
        if (timeDoc) {
            $chatMsg.append(timeDoc)
        }
        let content = message.content
        //拼装dom
        var mainDoc = document.createElement("div");
        $(mainDoc).addClass("chat__msgRow");

        var mainDocChild = document.createElement("div")
        var commonName = document.createElement("div")

        var imgDoc = document.createElement("img");

        if (isMain) {
            //头像img
            imgDoc.src = getChatterImage();
            $(imgDoc).addClass("contact__photo");
            $(imgDoc).css('float', 'right');
            $(imgDoc).css('display', 'inline');
            $(imgDoc).css('margin-right', '0rem');

            $(mainDocChild).css('margin-right', '0.5rem');
            $(mainDocChild).addClass("chat__message notMine");

        } else {
            commonName.innerText = chatter.name
            imgDoc.src = chatter.imgUrl;
            $(imgDoc).addClass("contact__photo");
            $(imgDoc).css('float', 'left');
            $(imgDoc).css('display', 'inline');
            $(imgDoc).css('margin-right', '0rem');

            $(mainDocChild).css('margin-left', '0.5rem');
            $(mainDocChild).addClass("chat__message mine");

            $(commonName).addClass("chat-common-left")
        }

        $(mainDocChild).css('position', 'relative');
        mainDoc.append(imgDoc);
        // mainDocChild.innerHTML = twemoji.parse(content,{"folder":"svg","ext":".svg","base":"asset/","size":15});
        mainDocChild.innerText = content.length > 200 ? content.slice(0, 200) + "\n...." : content
        mainDoc.append(commonName);
        mainDoc.append(mainDocChild);

        // 明细view
        if (content.length > 80) {
            var copyIcon = document.createElement("span");
            $(copyIcon).addClass("copy_icon");
            $(copyIcon).css('position', 'absolute');
            $(copyIcon).css('right', '0');
            $(copyIcon).css('bottom', '0');
            $(copyIcon).css('padding', '4px');
            $(copyIcon).css('cursor', 'pointer');
            const onClickCallback = (e) => {
                $viewContent[0].innerHTML = buildHighlightContent(content)
                addCopyButtonToPre($viewContent[0])
                $viewModal.modal('open')
            }
            $(copyIcon).on('click', onClickCallback)
            $(mainDocChild).on('click', onClickCallback)
            $(mainDocChild).css("cursor", "pointer")
            copyIcon.innerHTML = '<i class="material-icons" style="font-size: 15px;color: #868e8a;">launch</i>'
            mainDocChild.append(copyIcon)
        }
        return mainDoc;
    }

    commonFileDom = function (message, isUpload, isMain, uploadId, url, snapshotUrl, chatter) {
        const fileRender = getRender(url)
        return fileRender({
            message,
            isUpload,
            isMain,
            uploadId,
            url,
            snapshotUrl,
            chatter
        })
    }
})