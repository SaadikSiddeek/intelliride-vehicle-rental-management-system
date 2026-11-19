import {useState} from 'react';
import {Dialog} from '@base-ui/react/dialog';
import {Bot,X,Send,RotateCcw} from 'lucide-react';
import useConversation from '@/hooks/useConversation';
import {readableChatText} from '@/lib/chat-text.mjs';
import TypingIndicator from '@/components/TypingIndicator';
import product from '@/data/public-product.json';
export default function FloatingAssistant(){
 const [open,setOpen]=useState(false);
 const {messages,draft,setDraft,status,busy,notice,scroll,input,trackScroll,send,newChat,failed}=useConversation({scope:'public',enabled:open});
 return <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
  <Dialog.Trigger render={<button className="assistant-launcher" aria-label="Open IntelliRide Assistant"/>}>{open?<X size={22}/>:<Bot size={23}/>}</Dialog.Trigger>
  <Dialog.Portal><Dialog.Popup className="assistant-panel">
   <header className="assistant-header"><span className="assistant-mark"><Bot size={21}/></span><div><Dialog.Title>IntelliRide Assistant</Dialog.Title><Dialog.Description>{status}</Dialog.Description></div><button type="button" aria-label="New public chat" className="assistant-close" onClick={newChat}><RotateCcw size={17}/></button><Dialog.Close aria-label="Close assistant" className="assistant-close"><X size={18}/></Dialog.Close></header>
   <div ref={scroll} onScroll={trackScroll} className="assistant-messages" role="log" aria-live="polite" aria-label="Public help conversation">
    {!messages.length&&<div className="assistant-empty"><h3>Hi! I'm the IntelliRide Assistant.</h3><p>I can help you explore our vehicle rental management system, understand what we offer, and get started.</p></div>}
    {messages.map(message=><div className={`assistant-message message-${message.role}`} key={message.id}><p style={{whiteSpace:'pre-wrap'}}>{message.role==='assistant'?readableChatText(message.content):message.content}</p>{message.state==='error'&&<div role="alert" className="field-error"><p>{message.error}</p><button type="button" disabled={busy} onClick={()=>void send(message.content,message.id)}>Retry question</button></div>}</div>)}
    {busy&&<TypingIndicator/>}{notice&&<p role="status">{notice}</p>}
   </div>
   <div className="public-help-suggestions" aria-label="Suggested public questions">{product.suggestions.map(question=><button type="button" key={question} disabled={busy||failed} onClick={()=>void send(question)}>{question}</button>)}</div>
   <form className="assistant-composer" onSubmit={event=>{event.preventDefault();void send();}}><label htmlFor="assistant-message" className="sr-only">Ask IntelliRide product help</label><textarea ref={input} id="assistant-message" rows={1} value={draft} onChange={event=>setDraft(event.target.value)} maxLength={2000} disabled={failed} placeholder="Ask about IntelliRide…" onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}}/><button type="submit" aria-label="Send public question" disabled={busy||failed||!draft.trim()}><Send size={17}/></button></form>
   <p className="assistant-footnote"><a href={product.contact}>Contact Sales</a> · AI can make mistakes. Keep private records out of chat.</p>
  </Dialog.Popup></Dialog.Portal>
 </Dialog.Root>;
}
