let localStream;
let remoteStream;
let peerConnection;

let APP_ID='6f7d262f238443c09c9701e0e9128f0f';
//6f7d262f238443c09c9701e0e9128f0f
//'54de675bbac24850943b61c17f8a9e7e'
let token = null;
let uid =String(Math.floor(Math.random()*10000))
let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get("room")

if(!roomId)
{
    window.location = "lobby.html"
}


let client;
let channel;


var drawmode="pencil";

const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}


let init = async()=>{
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid,token})

    channel = client.createChannel(roomId)
    await channel.join()

    channel.on("MemberJoined",handleUserJoined)
    channel.on("MemberLeft",handleUserLeft)

    channel.on('ChannelMessage', handleMessageFromChannel);


    client.on("MessageFromPeer",handleMessageFromPeer)

    localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true})
    document.getElementById('user1').srcObject = localStream 
}


let handleMessageFromChannel = async (message, senderId) => {
    message = JSON.parse(message.text);
    console.log(message); // You can see the full content of the message here
    if (message.type === 'text') {
        let messageBox = document.getElementById('messages');
        let newMessage = document.createElement('p');
        newMessage.textContent = `${senderId}: ${message.content}`;
        messageBox.appendChild(newMessage);
    }
    else if (message.type === 'drawing') {
        let action = message.content;
        if (action.type === "pencil"||action.type === "eraser") {
            drawingActions.push(action);
            replayActions(); // 重新繪製包含新動作的畫布
        }
    }
    else if (message.type === 'drawingMode') {
        drawmode = message.content;
        console.log(message.content+'hi');
    }
    else if (message.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawingActions = []; // 清除所有繪畫動作
    }
};

let handleUserLeft = (MemberID)=>{
    document.getElementById('user2').style.display='none'
}
let handleMessageFromPeer = async (message,MemberID)=>{
    message = JSON.parse(message.text)
    console.log(message);
    if(message.type === 'offer')
    {
        createAnswer(MemberID,message.offer)
    }
    if(message.type ==='answer')
    {
        addAnswer(message.answer)
    }
    if(message.type ==='candidate')
    {
       if(peerConnection){
        peerConnection.addIceCandidate(message.candidate)
       }
    }
   
}
let handleUserJoined = async(MemberID) =>{
    console.log("A USER JOIN",MemberID)
    createOffer(MemberID)

}


let createPeerConnection = async (MemberID)=>{
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById("user2").srcObject = remoteStream
    document.getElementById("user2").style.display='block'
    if(!localStream){
        localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false})
        document.getElementById('user1').srcObject = localStream 
    }

    localStream.getTracks().forEach((track)=>{
        peerConnection.addTrack(track,localStream)
    })

    peerConnection.ontrack= (event) =>{
        event.streams[0].getTracks().forEach((track)=>{
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event)=>{
        if(event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({"type":"candidate","candidate":event.candidate})},MemberID)
        }
    }
}

let createOffer = async(MemberID) =>{
   
    await createPeerConnection(MemberID)
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({text:JSON.stringify({"type":"offer","offer":offer})},MemberID)
}

let createAnswer = async(MemberID,offer) =>{
    await createPeerConnection(MemberID)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    client.sendMessageToPeer({text:JSON.stringify({"type":"answer","answer":answer})},MemberID)

}


let addAnswer = async(answer)=>{
    if(!peerConnection.currentRemoteDescription)
    {
        peerConnection.setRemoteDescription(answer)
    }
}

let leaveChannel = async()=>{
    await channel.leave()
    await client.logout()
}

let sendMessage = async() => {
    let message = document.getElementById('input').value;
    document.getElementById('input').value = '';
    let messageBox = document.getElementById('messages');
    messageBox.innerHTML += `<p>You: ${message}</p>`;
    let messageObject = {
        text: JSON.stringify({
            type: 'text',
            content: message,  
            sender: uid,  
        })
    };
    console.log(messageObject.text);  // to check what you are sending
    await channel.sendMessage(messageObject);
};



function setDrawingMode(mode){
    drawmode = mode;
    let messageObject = {
        text: JSON.stringify({
            type: "drawingMode",
            content: drawmode,
            sender: uid,
        }),
    };
    channel.sendMessage(messageObject);
    console.log(drawmode);
}


var drawingActions = []; // 儲存所有動作
var canvas = document.getElementById("drawing-board");
var ctx = canvas.getContext("2d");
var isDrawing = false;
var currentColor = "black";

var currentLineWidth = 1;
var currentAction = null;

let brushSizeInput = document.getElementById("brush-size");

brushSizeInput.addEventListener("input", function() {
    let brushSize = brushSizeInput.value;
    currentLineWidth = brushSize;
});


// 當有畫筆動作時，將動作細節加入列表
function addDrawingAction(type, color, lineWidth, points) {
    let newAction = {
        type: type,
        color: color,
        lineWidth: lineWidth,
        points: points
    };
    drawingActions.push(newAction);

    let messageObject = {
        text: JSON.stringify({
            type: "drawing",
            content: newAction,
            sender: uid
        })
    };
    channel.sendMessage(messageObject);
}

var currentAction = null;
canvas.onmousedown = function(event) {
    isDrawing = true;
    var rect = canvas.getBoundingClientRect();
    var point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if(drawmode=="pencil"){
        currentColor='black';
        currentAction = {
            type: "pencil",
            color: currentColor,
            lineWidth: currentLineWidth,
            points: [point]
        };
    }
    else if(drawmode=="eraser"){
        currentColor='white';
        currentAction = {
            type: "eraser",
            color: currentColor,
            lineWidth: currentLineWidth,
            points: [point]
        };
    }
    
}

canvas.onmousemove = function(event) {
    if (isDrawing) {
        var rect = canvas.getBoundingClientRect();
        var point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        if(drawmode=="eraser"){
            currentColor='white';
        }
        else if(drawmode=="pencil"){
            currentColor='black';
        }
        
        currentAction.points.push(point);
        // 繪製新加入的點
        ctx.beginPath();
        ctx.moveTo(currentAction.points[currentAction.points.length - 2].x, currentAction.points[currentAction.points.length - 2].y);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentLineWidth;
        ctx.stroke();
    }
}

canvas.onmouseup = function(event) {
    if (isDrawing) {
        var rect = canvas.getBoundingClientRect();
        var point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        currentAction.points.push(point);
        addDrawingAction(currentAction.type, currentAction.color, currentAction.lineWidth, currentAction.points);
        isDrawing = false;
        currentAction = null;
    }
}

canvas.onmouseleave = function(event) {
    if (isDrawing) {
        var rect = canvas.getBoundingClientRect();
        var point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        currentAction.points.push(point);
        addDrawingAction(currentAction.type, currentAction.color, currentAction.lineWidth, currentAction.points);
        isDrawing = false;
        currentAction = null;
    }
}


function replayActions() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < drawingActions.length; i++) {
        var action = drawingActions[i];
        if (action.type === "pencil" || action.type === "eraser") {
            ctx.strokeStyle = action.color;
            ctx.lineWidth = action.lineWidth;
            for (var j = 1; j < action.points.length; j++) {
                ctx.beginPath();
                ctx.moveTo(action.points[j - 1].x, action.points[j - 1].y);
                ctx.lineTo(action.points[j].x, action.points[j].y);
                ctx.stroke();
            }
        }
        
    }
}

//每1/8秒檢查一次流量
setInterval(function(event) { 
    if (speedLimit) {
        
        var NowTime=new Date().getSeconds();
        if (NowTime<LimitStartTime)NowTime+=60;
        if(NowTime - LimitStartTime>=3)
        {
            speedLimit=false;//回復無限制流量
            threeSecondMessageCount=0;
        }
        addDrawingAction(currentAction.type, currentAction.color, currentAction.lineWidth, currentAction.points);
        threeSecondMessageCount++;
        currentAction ={
            type: "pencil",
            color: currentColor,
            lineWidth: currentLineWidth,
            points: [NowMousePoint]
        };
    } 
}, 125);

var clearButton = document.getElementById("clear-canvas");

clearButton.onclick = function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingActions = []; // 清除所有繪畫動作

    // 向頻道傳遞一個清除畫布的消息
    let messageObject = {
        text: JSON.stringify({
            type: "clear",
            sender: uid
        })
    };
    channel.sendMessage(messageObject);
}



window.addEventListener("beforeunload",leaveChannel)

init()
