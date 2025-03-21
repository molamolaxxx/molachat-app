// 用户相关逻辑
$(document).ready(function () {
    //常量
    const LIST_MESSAGE = 809;
    const CREATE_SESSION = 122;
    const EXCEPTION = 368;
    const RECEIVE_MESSAGE = 65;
    const RECEIVE_STREAM_MESSAGE = 66;
    const HEART_BEAT = 276;
    const VIDEO_REQUEST = 378;
    const VIDEO_RESPONSE = 379;

    //唯一用户标识
    var chatterId;
    //获取随机的chatterName
    createChatterName = function () {

        //从存储中读取chatterName
        if (localStorage.getItem("chatterName") != null) {
            return localStorage.getItem("chatterName");
        }

        var str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var namePrefixList = ["星巴克", "米奇", "米妮", "四月春风", "博丽灵梦",
            "大灰狼", "神里凌华", "乌鸦哥", "甘雨", "jojo",
            "黄鹤", "嘉然", "初音未来", "猫头鹰", "兔子",
            "狼人", "预言家", "女巫", "编译器", "猎人",
            "自动状态机", "虚拟机", "神经网络", "缓存", "数据库",
            "西施", "貂蝉", "自助酱大骨", "螃蟹", "龙虾",
            "青口", "生蚝", "扇贝", "喷射战士", "dio"
        ]
        var name = namePrefixList[Math.round(Math.random() * namePrefixList.length)] + "_";
        for (var i = 0; i < 5; i++) {
            name += str[Math.round(Math.random() * 61)]
        }
        console.log(name)
        return name;
    }
    //唯一用户昵称
    var chatterName = createChatterName();
    // 用户签名
    var chatterSign = getSign();
    //chatter头像
    var chatterImg;

    //flags
    var isLogin = false;

    //socket链接
    var socket;
    // dom
    var $user_info = $(".user_info");
    var $demo = $(".demo");
    var $menu = $("#menu");

    // token 
    var token = localStorage.getItem("token")

    //functions
    //如果未登录，给出弹窗
    validAlert = function () {
        if (!isLogin) {
            var mailContailer = $(".container")[0];
            mailContailer.remove();
            mailContailer.style = null;
            swal({
                title: "Welcome!",
                html: true,
                content: mailContailer,
                className: "none-bg",
                button: false,
            }).then((value) => {
                // 相同域名重复登录校验
                if (!addPageLock()) {
                    return false
                }
                setChatterName(chatterName)
                //头像
                setChatterImage((null == localStorage.getItem("imgUrl") ? "img/mola.png" : localStorage.getItem("imgUrl")))
                setChatterSign(chatterSign === "signature" ? "点击修改签名" : chatterSign)
                $alert.removeClass("hidden-bg-line");
                //弹窗
                popLoginForm();
            });
            var $alert = $(".swal-overlay")
            $alert.addClass("hidden-bg-line")
        }
    }

    popLoginForm = function () {
        setTimeout(function () {
            if (window.innerWidth > 1000) {
                // 弹窗变成显示状态
                // $user_info.css({"display":""})
                // $('.collapsible-header').click();
                // $(".user_info").animate({ "opacity": 1 })
            }
            // 聊天窗动画渐进
            $demo.animate({
                "opacity": 1
            }, 800)
            $menu.animate({
                "opacity": 1
            }, 800)
            recoverChatter()

        }, 500);
    }

    recoverChatter = function () {
        initChatterMap()
        addSpinner("app_content", true)
        // 先检测有没有残留的chatterId
        var preId = localStorage.getItem("preId");
        $.ajax({
            url: getPrefix() + "/chat/chatter/reconnect",
            type: "post",
            xhrFields: {
                withCredentials: true
            },
            crossDomain: true,
            dataType: "json",
            timeout: 10000,
            data: {
                "chatterId": preId,
                "token": token,
                "deviceId": getDeviceId()
            },
            success: function (result) {
                if (window.changeUserLock) {
                    window.changeUserLock = false
                }
                if (preId == result.data.id) {
                    chatterId = preId;
                    // 将更新的token插入缓存
                    if (result.data.token) {
                        let data = result.data
                        localStorage.setItem("token", data.token)
                        token = data.token
                        setChatterName(data.name)
                        setChatterImage(data.imgUrl)
                        setChatterSign(data.signature)
                    }
                    linkToServer();
                    // swal("Welcome!", "重连成功", "success")
                    if (!$("#sidebar").hasClass("active")) {
                        window.openSideBar()
                    }
                    notRepeatToast("服务器连接成功，欢迎回来", 1000)
                    removeSpinner()

                } else {
                    swal("error", "id不一致，重连失败", "error")
                }
            },
            error: function (result) {
                if (!result || !result.responseText) {
                    checkHost()
                    return
                }
                response = JSON.parse(result.responseText)
                if (response.data && response.data.isOverFlow) {
                    swal("sorry", "抱歉，会话人数已达上限", "warning")
                    return
                }
                if (localStorage.getItem("preId")) {
                    createChatter()
                } else {
                    createChatter()
                }

            },
            complete: function (xhr, status) {
                if (status == 'timeout') {
                    swal("sorry", "连接超时，请重试", "info")
                        .then((value) => {
                            if (value) {
                                recoverChatter()
                            }
                        });
                }
            }
        });
    }

    /**
     * 更改用户
     */
    changeChatter = function (base64Secret) {
        // 正在和其他人通话
        if (getEngines().videoEngine.isOpen()) {
            showToast("您正在通话中，无法切换用户", 1000)
            return
        }
        if (window.uploadLock) {
            showToast("文件正在上传，无法切换用户", 1000)
            return
        }
        // 解析base64，拆出preId和token
        var decodedData = atob(base64Secret);
        if (isEmpty(decodedData)) {
            showToast("序列为空无法解析", 1000)
            return
        }
        let arr = decodedData.split(";")
        if (arr.length != 2) {
            showToast("序列解析失败", 1000)
            return
        }
        // 取出当前的preId和token，存储在localstore中
        const localPreId = localStorage.getItem("preId")
        const localToken = localStorage.getItem("token")
        if (!isNull(localPreId) && !isNull(localToken)) {
            const localSecret = btoa(localPreId + ";" + localToken)
            let secretHistoryStr = localStorage.getItem("secretHistory")
            var set = new Set()
            if (!isEmpty(secretHistoryStr)) {
                set = new Set(Array.from(JSON.parse(secretHistoryStr)));
                set.forEach(e => {
                    let tmp = atob(e);
                    if (!isEmpty(tmp) && (arrTmp = tmp.split(";")).length === 2) {
                        if (arrTmp[0] === localPreId) {
                            set.delete(e)
                        }
                    }
                })
            }
            set.add(localSecret)
            localStorage.setItem("secretHistory", JSON.stringify(Array.from(set)))
        }
        // 锁。防止在换用户期间发生心跳，导致id、token不一致的情况
        window.changeUserLock = true
        // 赋值
        localStorage.setItem("preId", arr[0])
        token = arr[1]
        if (socket !== null) {
            socket.close()
        }
        // 重连
        recoverChatter()
        // 弹出
        if ($(".chat.active").length !== 0) {
            $(".chat__back")[0].click();
        }

    }

    getHistoryChatters = function (renderMethod, renderEmpty) {
        const base64List = JSON.parse(localStorage.getItem("secretHistory"))
        if (!base64List) {
            if (renderEmpty) {
                renderEmpty()
            }
            return
        }
        const chatterIdList = []
        for (let index = 0; index < base64List.length; index++) {
            const decodedData = atob(base64List[index]);
            let arr = decodedData.split(";")
            if (arr.length != 2) {
                continue
            }
            chatterIdList.push(arr[0])
        }
        if (chatterIdList.length === 0) {
            if (renderEmpty) {
                renderEmpty()
            }
            return
        }
        let selfChatterId = (chatterId ? chatterId : localStorage.getItem("preId"))
        $.ajax({
            url: getPrefix() + "/chat/chatter/getChatterListById",
            type: "post",
            xhrFields: {
                withCredentials: true
            },
            crossDomain: true,
            dataType: "json",
            timeout: 10000,
            data: {
                chatterId: selfChatterId,
                token,
                chatterIdList: JSON.stringify(chatterIdList)
            },
            success: function (result) {
                const historyUsers = result.data
                const newBase64List = []
                for (let index = 0; index < historyUsers.length; index++) {
                    const element = historyUsers[index];
                    element.base64 = base64List[index]
                    newBase64List.push(element.base64)
                }
                localStorage.setItem("secretHistory", JSON.stringify(newBase64List))
                // 渲染
                if (renderMethod) {
                    renderMethod(historyUsers)
                }
            },
            error: function (result) {
                showToast("加载历史登录记录失败", 1000)
            }
        })
    }

    getSecret = function () {
        return btoa(chatterId + ";" + token)
    }

    //创建用户信息，获取chatterId
    createChatter = function () {
        $.ajax({
            url: getPrefix() + "/chat/chatter",
            dataType: "json",
            type: "delete",
            xhrFields: {
                withCredentials: true
            },
            crossDomain: true,
            data: {
                "preId": localStorage.getItem("preId")
            },
            success: function (result) {
                // 从本地读取头像链接
                var imgUrl = localStorage.getItem("imgUrl");
                if (null == imgUrl) {
                    // 随机生成头像
                    var rand = Math.ceil(Math.random() * 1000000000) % 15 + 1;
                    imgUrl = "img/header/" + rand + ".jpeg"
                    // imgUrl = "img/mola.png";
                }
                $.ajax({
                    url: getPrefix() + "/chat/chatter",
                    dataType: "json",
                    type: "post",
                    xhrFields: {
                        withCredentials: true
                    },
                    crossDomain: true,
                    data: {
                        "chatterName": chatterName,
                        "signature": chatterSign,
                        "imgUrl": imgUrl,
                        "preId": localStorage.getItem("preId")
                    },
                    success: function (result) {
                        chatterId = result.data.id
                        token = result.data.token
                        localStorage.setItem("token", result.data.token)
                        localStorage.setItem("preId", chatterId)
                        //链接到ws服务器
                        linkToServer();
                        swal("Welcome!", "已成功创建chatter!", "success");
                        removeSpinner()
                        if (!$("#sidebar").hasClass("active")) {
                            window.openSideBar()
                        }
                    },
                    error: function (result) {
                        console.log(result.responseText);
                        var exception = JSON.parse(result.responseText);
                        swal("error", "创建chatter失败,请刷新重试，原因是" + (exception.msg ? exception.msg : exception.message), "error")
                    }
                });
            }
        });

    }

    var socketErrorTimes = 0
    linkToServer = function () {
        if (chatterId == null) {
            swal("error", "未获取chatterId，连接服务器失败!", "error");
            return;
        }
        if (socket) {
            socket.close()
        }
        socket = new WebSocket(getSocketPrefix() + "/chat/server/" + chatterId + "," + getDeviceId());
        socket.onopen = function (ev) {
            console.info("socket已经打开");
            console.info(ev);
        };

        socket.onmessage = function (ev) {
            var result = JSON.parse(ev.data)
            if (result.code == LIST_MESSAGE) {
                var chatterList = result.data;
                //刷新聊天列表
                initChatter(chatterList, chatterId);
            } else if (result.code == EXCEPTION) {
                swal(result.msg, result.data, "error").then(
                    () => {
                        $(".chat__back")[0].click();
                    }
                )
            } else if (result.code == CREATE_SESSION) {
                //新建session
                createSession(result.data);
            } else if (result.code == RECEIVE_MESSAGE) {
                //收到消息
                receiveMessage(result.data);
            } else if (result.code == RECEIVE_STREAM_MESSAGE) {
                //收到消息
                receiveStreamMessage(result.data);
            } else if (result.code == VIDEO_REQUEST) {
                // 视频消息请求
                receiveVideoRequest(result.data)
            } else if (result.code == VIDEO_RESPONSE) {
                // 视频消息返回
                receiveVideoResponse(result.data)
            }
            // console.info(result);
        };

        socket.onerror = function (ev) {
            if (socketErrorTimes > 10) {
                swal("出错啦", "服务器连接崩溃了，请重新连接", "info").then((value) => {
                    socketErrorTimes = 0
                    reconnect();
                })
            } else {
                socketErrorTimes++
            }
            console.info("socket出错");
            console.info(ev);
        }

        socket.onclose = function (ev) {
            console.info("socket退出");
            console.info(ev);

        }
    }

    // 获取签名
    function getSign() {
        //从存储中读取sign
        if (localStorage.getItem("sign") != null) {
            return localStorage.getItem("sign");
        }
        return "signature"
    }

    //重新连接
    reconnect = function (onSuccess) {
        $.ajax({
            url: getPrefix() + "/chat/chatter/reconnect",
            type: "post",
            dataType: "json",
            xhrFields: {
                withCredentials: true
            },
            crossDomain: true,
            timeout: 10000,
            data: {
                "chatterId": chatterId,
                "token": token,
                "deviceId": getDeviceId()
            },
            success: function (result) {
                if (chatterId == result.data.id) {
                    linkToServer();
                    // 将更新的token插入缓存
                    if (result.data.token) {
                        localStorage.setItem("token", result.data.token)
                    }
                    notRepeatToast("服务器连接成功，欢迎回来", 1000)
                    if (onSuccess) {
                        onSuccess()
                    }
                } else {
                    swal("error", "id不一致，重连失败", "error")
                }
            },
            error: function (result) {
                response = JSON.parse(result.responseText)
                if (response.data && response.data.isOverFlow) {
                    swal("sorry", "抱歉，会话人数已达上限", "warning")
                    return
                }
                // setTimeout(function() {
                //     reconnect()
                // }, 2000);
                notRepeatToast("重连失败，原因是:" + response.msg, 1000)
            },
            complete: function (xhr, status) {
                if (status == 'timeout') {
                    // 超时后中断请求
                    xhr.abort();
                    reconnect()
                }
            }
        });
    }

    //心跳检测异常次数
    var heartBeatErrorCnt = 0

    var sendMainHeartBeatIdx = 0
    sendHeartBeat = function () {
        if (window.changeUserLock) {
            console.log("更换用户锁住，心跳停止");
            return
        }
        if (!socket) {
            return
        }
        localStorage.setItem("lastHeartBeat", Date.now())
        if (socket.readyState == WebSocket.CLOSED) {
            addSpinner("app_content", true)
            reconnect(() => {
                heartBeatErrorCnt = 0;
                removeSpinner()
            });
            return
        }
        var action = new Object();
        action.code = HEART_BEAT;
        action.msg = "heart-beat";
        action.data = chatterId + "," + getDeviceId();
        //未连接时，不发送心跳
        if (null != socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(action));
            sendMainHeartBeatIdx++
        }

        if (sendMainHeartBeatIdx !== 10) {
            return
        }
        sendMainHeartBeatIdx = 0
        //测试连接url
        $.ajax({
            url: getPrefix() + "/chat/chatter/heartBeat",
            type: "get",
            dataType: "json",
            xhrFields: {
                withCredentials: true
            },
            crossDomain: true,
            timeout: 10000,
            data: {
                "chatterId": chatterId,
                "token": token,
                "deviceId": getDeviceId()
            },
            success: function (result) {
                if (result.msg == "reconnect") {
                    console.log("ip改变，需要重连");
                    reconnect(() => {
                        heartBeatErrorCnt = 0;
                        removeSpinner()
                    });
                } else if (result.msg == "no-server-exist") {
                    console.log("服务器对象被移除");
                    reconnect(() => {
                        heartBeatErrorCnt = 0;
                        removeSpinner()
                    });
                } else if (heartBeatErrorCnt > 0) {
                    reconnect(() => {
                        heartBeatErrorCnt = 0;
                        removeSpinner()
                    });
                }
            },
            error: function (result) {
                heartBeatErrorCnt++
                if (heartBeatErrorCnt % 3 == 1) {
                    // showToast("心跳检查异常，尝试重新连接服务器", 1000)
                    addSpinner("app_content", true)
                }
                reconnect(() => {
                    heartBeatErrorCnt = 0;
                    removeSpinner()
                });
            },
            complete: function (xhr, status) {
                if (status == 'timeout') {
                    // 超时后中断请求
                    xhr.abort();
                    heartBeatErrorCnt++
                }
            }
        })
    }

    //发送心跳包
    var timer = setInterval(sendHeartBeat, 1000);

    getSocket = function () {
        return socket;
    }
    getChatterId = function () {
        return chatterId;
    }

    getChatterName = function () {
        return chatterName;
    }

    setChatterSign = function (sign) {
        chatterSign = sign;
        $(".collapsible-body").find('p')[1].innerHTML = "<a class='material-icons' style='font-size: 14px;color: #716060;' href='javascript:changeSign();'>create</a>&nbsp;" + chatterSign;
        setNavSign(sign)
        localStorage.setItem("sign", sign);
    }

    getChatterSign = function () {
        return chatterSign;
    }

    setChatterName = function (name) {
        chatterName = name;
        let shortenName = shortenString(name, 20)
        console.log(shortenName)
        $(".collapsible-body").find('p')[0].innerHTML = "<i class='material-icons' style='font-size: 16px;color: #716060;vertical-align: middle;'>account_box</i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + shortenName + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a class='material-icons' style='font-size: 16px;color: #716060;vertical-align: middle;' href='javascript:changeName();'>create</a>";
        setNavName(name)
        localStorage.setItem("chatterName", name);
    }

    setChatterImage = function (src) {
        chatterImg = src;
        $("img.gravatar")[0].src = chatterImg
        setNavImg(src)
        localStorage.setItem("imgUrl", src);
    }

    setToken = function (newToken) {
        token = newToken
        localStorage.setItem("token", newToken);
    }

    getChatterImage = function () {
        return chatterImg;
    }

    // 检查版本
    checkVersion(validAlert);
});