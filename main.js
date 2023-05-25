let localStream;
let remoteStream;
let peerConnection;

let remoteStream3;
let peerConnection3;

let APP_ID="54de675bbac24850943b61c17f8a9e7e";
let token = null;
let uid =localStorage.getItem('Uid');
let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
console.log(window.location.search)
let roomId = urlParams.get("room")
document.getElementById('messages').innerHTML += `<p>${uid} join the chat.</p>`
let recoverCanvas=false;//新加入的使用者回復canvas的圖像
var us2=null
var us3=null//第二和第三個使用者
if(!roomId)
{
    window.location = "lobby.html"
}


let client;
let channel;


var drawmode="pencil";
var remotedrawmode="pencil";
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

var recoverURLFull="";
var recoverer=null;
var haveRecoverer=false;
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
            replayActions(); 
        }
    }

    else if (message.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';  // 设置填充颜色为白色
        ctx.fillRect(0, 0, canvas.width, canvas.height);  // 绘制一个和画布一样大的矩形
        drawingActions = []; 
    }
    else if (message.type === 'recover'){

        if(!recoverCanvas)
        {   
            if(!haveRecoverer)
            {
                recoverer=message.sender;
                haveRecoverer=true;
            }
            if(recoverer==message.sender)
            {
                recoverURLFull+=message.content;
                if(recoverURLFull[recoverURLFull.length-1]==']')
                {   
                    recoverURLFull=recoverURLFull.slice(0, -1);
                    console.log(recoverURLFull);
                    var img = new Image();
                    img.src = recoverURLFull;
                    img.onload = function() {
                        var canvas = document.getElementById("drawing-board");
                        var context = canvas.getContext('2d');
                        context.clearRect(0, 0, canvas.width, canvas.height); // 清除畫布
                        context.drawImage(img, 0, 0); // 繪製圖像
                    };
                    recoverCanvas=true;
                }
            }
        }
    }
};

let handleUserLeft = (MemberID)=>{
    if(MemberID==us2)
    {
        document.getElementById('user2').style.display='none';
        us2=null;
        document.getElementById('d2').innerHTML=us2
    }   
    else if(MemberID==us3)
    {
        document.getElementById('user3').style.display='none';
        us3=null;
        document.getElementById('d3').innerHTML=us3
    }
    document.getElementById('messages').innerHTML += `<p>${MemberID} leave the chat.</p>`
}
let handleMessageFromPeer = async (message,MemberID)=>{
    message = JSON.parse(message.text)
    console.log(MemberID)
    console.log(message);
    console.log("us2",us2)
    console.log("us3",us3)
    if(message.type === 'offer')
    {
        if(us2==null)
        {
            us2=MemberID
        }
        else if(us3==null)
        {
            us3=MemberID
        }
        console.log("GET OFFER")
        createAnswer(MemberID,message.offer)
    }
    if(message.type ==='answer')
    {
        console.log(message.answer)
        addAnswer(message.answer,MemberID)
    }
    if(message.type ==='candidate')
    {
        console.log("candidate get daze")
        console.log(message.candidate)
        
       if(us2==MemberID&&peerConnection){
        peerConnection.addIceCandidate(message.candidate)
       }
       else if(us3==MemberID&&peerConnection3)
       {
        peerConnection3.addIceCandidate(message.candidate)
       }
    }
   
}
let handleUserJoined = async(MemberID) =>{
    console.log("A USER JOIN",MemberID)
    if(us2==null)
    {
        console.log("US2=MEM")
        us2=MemberID
    }
    else if(us3==null)
    {
        console.log("US3=MEM")
        us3=MemberID
    }
    createOffer(MemberID)
    document.getElementById('messages').innerHTML += `<p>${MemberID} join the chat.</p>`
    //傳送當前畫布給其他用戶
    var NowCanvas=document.getElementById("drawing-board").toDataURL('image/webp')//當前圖片的URL
    console.log(NowCanvas)
    console.log(NowCanvas.length)
    let chunkSize = 14000;  // 每段的長度
    let chunks = [];
    for (let i = 0; i < NowCanvas.length; i += chunkSize) {
        chunks.push(NowCanvas.substring(i, i + chunkSize));
    }

    //chunks包含分段的URL
    for(let i = 0; i<chunks.length;i++)
    {
        if(i==chunks.length-1)
        {chunks[i]+=']'}
        let messageObject = {
            text: JSON.stringify({
            type: 'recover',
            content: chunks[i],  
            sender: uid,  
            })
        };
        console.log(messageObject.text);  // to check what you are sending
        await channel.sendMessage(messageObject);
    }
}


let createPeerConnection = async (MemberID)=>{
    console.log("CPCONNECTION")
    //console.log(us2)
    //console.log(MemberID)
    if (us2==MemberID)
    {
        peerConnection = new RTCPeerConnection(servers)
        remoteStream = new MediaStream()      
        console.log("NEW CONNECTION US2:",us2)       
        document.getElementById("user2").srcObject = remoteStream
        document.getElementById("user2").style.display='block'
        document.getElementById('d2').innerHTML=us2
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
    else if(us3==MemberID)
    {
        peerConnection3 = new RTCPeerConnection(servers)
        remoteStream3 = new MediaStream()
        console.log("NEW CONNECTION US3:",us3)
        document.getElementById("user3").srcObject = remoteStream3
        document.getElementById("user3").style.display='block'
        document.getElementById('d3').innerHTML=us3
        if(!localStream){
            localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false})
            document.getElementById('user1').srcObject = localStream 
        }
        localStream.getTracks().forEach((track)=>{
            peerConnection3.addTrack(track,localStream)
        })

        
        peerConnection3.ontrack= (event) =>{
            event.streams[0].getTracks().forEach((track)=>{
                remoteStream3.addTrack(track)
            })
        }

        peerConnection3.onicecandidate = async (event)=>{
            if(event.candidate){
                client.sendMessageToPeer({text:JSON.stringify({"type":"candidate","candidate":event.candidate})},MemberID)
            }
        }
    }

   

}

let createOffer = async(MemberID) =>{
    //console.log("COFFER")
    let offer
    await createPeerConnection(MemberID)

    if(us2==MemberID)
    {
        offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
    }
    else if(us3==MemberID)
    {
        offer = await peerConnection3.createOffer()
        await peerConnection3.setLocalDescription(offer)
    }
    client.sendMessageToPeer({text:JSON.stringify({"type":"offer","offer":offer})},MemberID)
}

let createAnswer = async(MemberID,offer) =>{
    //console.log("CAnswer")
    let answer
    await createPeerConnection(MemberID)
    if(us2 == MemberID)
    {
        await peerConnection.setRemoteDescription(offer)
        answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
    }
    else if (us3==MemberID)
    {
        await peerConnection3.setRemoteDescription(offer)
        answer = await peerConnection3.createAnswer()
        await peerConnection3.setLocalDescription(answer)
    }
    client.sendMessageToPeer({text:JSON.stringify({"type":"answer","answer":answer})},MemberID)

}


let addAnswer = async(answer,MemberID)=>{
    console.log(us2)
    console.log(us3)
    console.log(MemberID)
    if(us2==MemberID)
    {
        if(!peerConnection.currentRemoteDescription)
        {
            peerConnection.setRemoteDescription(answer)
        }
    }
    if(us3==MemberID)
    {
        if(!peerConnection3.currentRemoteDescription)
        {
            peerConnection3.setRemoteDescription(answer)
        }
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

}


var drawingActions = []; // 儲存所有動作
var canvas = document.getElementById("drawing-board");
var ctx = canvas.getContext("2d");
ctx.fillStyle = '#ffffff';  // 设置填充颜色为白色
ctx.fillRect(0, 0, canvas.width, canvas.height);  // 绘制一个和画布一样大的矩形
var isDrawing = false;
var currentColor = "black";

var currentLineWidth = 1;

var threeSecondMessageCount=0;
var speedLimit=false;
var NowMousePoint=(0,0);
var currentAction =    {
    type: "pencil",
    color: 'white',
    lineWidth: currentLineWidth,
    points: [NowMousePoint]
};
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
        points: points,
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


let colorPicker = document.getElementById("color-picker");
let pickedColor = colorPicker.value;
canvas.onmousedown = function(event) {
    isDrawing = true;
    var rect = canvas.getBoundingClientRect();
    var point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    NowMousePoint=point;
    if(drawmode=="pencil"){
        currentColor=pickedColor;
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

        currentAction.points.push(point);
        NowMousePoint=point;
        // 繪製新加入的點
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(currentAction.points[currentAction.points.length - 2].x, currentAction.points[currentAction.points.length - 2].y);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentLineWidth;
        ctx.stroke();
        currentAction.points.push(point);           
        

        
    }
}

canvas.onmouseup = function(event) {
    if (isDrawing) {
        var rect = canvas.getBoundingClientRect();
        var point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        currentAction.points.push(point);
        addDrawingAction(currentAction.type, currentAction.color, currentAction.lineWidth, currentAction.points);
        isDrawing = false;
        currentAction ={
            type: "pencil",
            color: currentColor,
            lineWidth: currentLineWidth,
            points: [NowMousePoint]
        };
    }
}

canvas.onmouseleave = function(event) {
    if (isDrawing) {
        var rect = canvas.getBoundingClientRect();
        var point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        currentAction.points.push(point);
        addDrawingAction(currentAction.type, currentAction.color, currentAction.lineWidth, currentAction.points);
        isDrawing = false;
        currentAction ={
            type: "pencil",
            color: currentColor,
            lineWidth: currentLineWidth,
            points: [NowMousePoint]
        };
    }
}


function replayActions() {
    //ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < drawingActions.length; i++) {
        var action = drawingActions[i];
        if (action.type === "pencil" || action.type === "eraser") {
            ctx.strokeStyle = action.color;
            ctx.lineWidth = action.lineWidth;
            for (var j = 1; j < action.points.length; j++) {
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(action.points[j - 1].x, action.points[j - 1].y);
                ctx.lineTo(action.points[j].x, action.points[j].y);
                ctx.stroke();
            }
        }
        
    }
    drawingActions=[]
}

//每1/8秒檢查一次流量
setInterval(function(event) { 
    if(currentAction.points.length>1){
        addDrawingAction(currentAction.type, currentAction.color, currentAction.lineWidth, currentAction.points);
        threeSecondMessageCount++;
        currentAction ={
            type: "pencil",
            color: currentColor,
            lineWidth: currentLineWidth,
            points: [NowMousePoint]
        };}
     
}, 20);

var clearButton = document.getElementById("clear-canvas");

clearButton.onclick = function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';  // 设置填充颜色为白色
    ctx.fillRect(0, 0, canvas.width, canvas.height);  // 绘制一个和画布一样大的矩形
    drawingActions = []; // 清除所有繪畫動作

    let messageObject = {
        text: JSON.stringify({
            type: "clear",
            sender: uid
        })
    };
    channel.sendMessage(messageObject);
}


colorPicker.addEventListener("input", function() {
    pickedColor = colorPicker.value;
    currentColor = pickedColor;
    
});



window.addEventListener("beforeunload",leaveChannel)

init()