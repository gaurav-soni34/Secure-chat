"use client";

import { useUsername } from "@/src/hooks/use-username";
import { client } from "@/src/lib/client";
import { useRealtime } from "@/src/lib/realtime-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { time } from "console";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { Message } from "@/src/lib/realtime";


function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Fallback copy to clipboard using textarea (for non-HTTPS or older browsers)
function fallbackCopyToClipboard(text: string): boolean {
  try {
    // Create a temporary textarea element
    const textarea = document.createElement("textarea");
    
    // Set styles to make it invisible and prevent any layout shift
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "2em";
    textarea.style.height = "2em";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    
    // Set the text to copy
    textarea.value = text;
    
    // Append to DOM
    document.body.appendChild(textarea);
    
    // Select the text
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    
    // Copy the text using the deprecated but widely supported execCommand
    const successful = document.execCommand("copy");
    
    // Remove the textarea
    document.body.removeChild(textarea);
    
    if (successful) {
      console.log("Fallback copy succeeded");
      return true;
    } else {
      console.warn("Fallback copy command returned false");
      return false;
    }
  } catch (error) {
    console.error("Fallback copy failed:", error);
    return false;
  }
}

const Page = () => {
  const params = useParams();
  const roomId = params.roomId as string;
  const router =useRouter()

  const { username } = useUsername();

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [copyStatus, setCopyStatus] = useState("Copy");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { data:ttlData}=useQuery({
    queryKey:["ttl", roomId],
    queryFn: async ()=>{
      const res= await client.room.ttl.get({
        query:{roomId} })
        return res.data
    },
  })

  useEffect(()=>{
    if(ttlData?.ttl !== undefined)
      setTimeRemaining(ttlData.ttl)
  },[ttlData])

  useEffect(()=>{
    if(timeRemaining===null || timeRemaining <0) return

    if( timeRemaining === 0){
      router.push("/?destroyed=true")
      return
    }

    const interval=setInterval(()=>{
      setTimeRemaining((prev)=>{
        if(prev === null || prev<= 1){
         
            clearInterval(interval)
            return 0  
        }
        return prev - 1
      })
    },1000)
    return ()=> clearInterval(interval)
  },[timeRemaining, router])

  const {data: messages,refetch}=useQuery({
    queryKey: ["messages", roomId],
    queryFn: async()=>{
      const res=await client.messages.get({query:{roomId}})
      return res.data
    },
  })

  const { mutate: sendMessage,isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post(
        { sender: username, text },
        { query: { roomId } });
        setInput("")
    },
  });

  useRealtime({
    channels:[roomId],
    events:["chat.message", "chat.destroy"],
    onData:({event})=>{
      if(event==="chat.message"){
          refetch()
        }

        if(event==="chat.destroy"){
            router.push("/?destroyed=true")
         }
     },
  })

  const {mutate: destroyRoom}=useMutation({
    mutationFn: async()=>{
      await client.room.delete(null,{query:{roomId}})
    },
  })

  // Production-safe copy to clipboard with proper error handling and fallbacks
  const copyLink = async () => {
    const url = window.location.href;
    let copySuccess = false;

    try {
      // Check if Clipboard API is available and we're in a secure context (HTTPS)
      if (navigator.clipboard && window.isSecureContext) {
        try {
          // Try the modern Clipboard API first
          await navigator.clipboard.writeText(url);
          copySuccess = true;
          console.log("Clipboard API succeeded");
        } catch (clipboardError) {
          // Clipboard API failed (permission denied, or other error)
          console.warn("Clipboard API failed, attempting fallback method:", clipboardError);
          copySuccess = fallbackCopyToClipboard(url);
        }
      } else {
        // Clipboard API not available or not in secure context (HTTP)
        const reason = !navigator.clipboard ? "Clipboard API not available" : "Not in secure context (HTTPS required)";
        console.warn(`Clipboard API unavailable (${reason}), using fallback method`);
        copySuccess = fallbackCopyToClipboard(url);
      }

      // Update UI status based on success/failure
      if (copySuccess) {
        setCopyStatus("Copied!");
        setTimeout(() => {
          setCopyStatus("Copy");
        }, 2000);
      } else {
        setCopyStatus("Failed!");
        setTimeout(() => {
          setCopyStatus("Copy");
        }, 2000);
      }
    } catch (error) {
      // Catch any unexpected errors
      console.error("Unexpected error in copyLink:", error);
      setCopyStatus("Failed!");
      setTimeout(() => {
        setCopyStatus("Copy");
      }, 2000);
    }
  };

  return (
    <main className="flex flex-col h-screen max-h-scrren overflow-hidden">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/30">
        <div className=" flex items-center gap-4">
          <div className=" flex flex-col ">
            <span className="text-xs text-zinc-500 uppercase">Room ID</span>
            <div className=" flex item-center gap-2">
              <span className="font-bold text-green-500">{roomId}</span>
              <button
                onClick={copyLink}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700
                    px-2 py0.5 rounded text-zinc-400 hover:text-zinc-200
                    transition-colors"
              >
                {copyStatus}
              </button>
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />

          <div className="flex flex-col">
            <span
              className="text-xs
             text-zinc-500 
             uppercase"
            >
              Self-Destruct
            </span>
            <span
              className={`text-sm
                font-bold flex items-center gap-2
                ${
                  timeRemaining !== null && timeRemaining < 60
                    ? "text-red-500"
                    : "text-amber-500"
                }`}
            >
              {" "}
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
        </div>

        <button
          onClick={() => destroyRoom()}
          className="text-xs
        bg-zinc-800 hover:bg-red-600 px-3
        py-1.5 rounded text-zinc-400
        hover:text-white font-bold
        transition-all group flex 
        items-center gap-2 disabled:opacity-50"
        >
          <span className="group-hover:animate-pulse">💣</span>
          DESTROY NOW
        </button>
      </header>
        {/* MESSAGES */}
      <div
        className="flex-1 overflow-y-auto
      p-4 space-y-4 scrollbar-thin">
        {messages?.messages.length === 0 && (
          <div className="flex items-center justify-center
          h-full">
            <p className="text-zinc-600 text-sm front-mono">
              No messages yet, start the conversation.
            </p>
          </div>
        )}

          {messages?.messages.map((msg: Message)=>( 
          <div key={msg.id} className="flex flex-col 
          items-start">
            <div className="max-w-[80%] group">
              <div className="flex items-baseline-line
              gap-3 mb-1">
                <span className={`text-xs font-bold 
                  ${
                    msg.sender=== username ?
                    "text-green-500" :
                    "text-blue-500"
                  } `}>
                  {msg.sender === username ? 
                  "YOU" : msg.sender}
                  </span>

                  <span className="text-[10px]
                  text-zinc-600">{format(msg.timestamp,"HH:mm")}</span>

              </div>
              <p className="text-zinc-300 leading-relaxed break-all">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div
        className="p-4 border-t
    border-zinc-800 bg-zinc-900/30"
      >
        <div className="flex gap-4">
          <div
            className="flex-1 relative
            group"
          >
            <span
              className=" absolute left-4 top-1/2 -translate-y-1/2
                text-green-500 animate-pulse"
            >
              {">"}
            </span>
            <input
              autoFocus
              type="text"
              value={input}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  //TOO SEND MSG
                  sendMessage({ text: input });
                  inputRef.current?.focus();
                }
              }}
              placeholder="Type message..."
              onChange={(e) => {
                setInput(e.target.value);
              }}
              className=" w-full bg-black border
                border-zinc-800 
                focus:border-zinc-700
                focus:outline-none
                transition-colors text-zinc-100
                placeholder:text-zinc-700
                py-3 pl-8 pr-4 text-sm"
            />
          </div>
          <button
            onClick={()=>{
              sendMessage({ text:input})
              inputRef.current?.focus()
            }}
            disabled={!input.trim() || isPending}
            className="bg-zinc-800
            text-zinc-400 px-6 text-sm 
            font-bold hover:text-zinc-200
            transition-all disabled:opacity-50
            disabled:cursor-not-allowed
            cursor-pointer"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  );
};

export default Page;
