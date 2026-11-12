import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseIcon } from '@solar-icons/react/linear/close';
import { useRef } from 'react';
import type { ReactNode } from 'react';
// shadcn/ui dialog composition, styled using the shared application tokens.
export function Dialog({open,onOpenChange,title,description,children,className,showClose = true,suspendModal = false,initialFocusContent = false,restoreFocus = true}:{open:boolean;onOpenChange(open:boolean):void;title:string;description?:string;children:ReactNode;className?:string;showClose?:boolean;suspendModal?:boolean;initialFocusContent?:boolean;restoreFocus?:boolean}) {
  const contentRef=useRef<HTMLDivElement>(null);
  const previousOpen=useRef(false), opener=useRef<HTMLElement|null>(null), suspended=useRef(suspendModal);
  suspended.current=suspendModal;
  if(open && !previousOpen.current) opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  previousOpen.current=open;
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={!suspendModal}>
    <DialogPrimitive.Portal>
      {suspendModal ? (open ? <div className="dialog-overlay" aria-hidden="true"/> : null) : <DialogPrimitive.Overlay className="dialog-overlay" />}
      <DialogPrimitive.Content ref={contentRef} className={`dialog-content${className ? ` ${className}` : ''}`} {...(!description ? {'aria-describedby': undefined} : {})} onOpenAutoFocus={event=>{if(suspended.current)event.preventDefault();else if(initialFocusContent){event.preventDefault();contentRef.current?.focus();}}} onInteractOutside={event=>{if(suspended.current)event.preventDefault();}} onEscapeKeyDown={event=>{if(suspended.current)event.preventDefault();}} onCloseAutoFocus={event=>{event.preventDefault();if(suspended.current||!restoreFocus)return;if(opener.current?.isConnected)opener.current.focus();else document.querySelector<HTMLElement>('[data-document-menu-trigger]')?.focus();}}>
        <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
        {description ? <DialogPrimitive.Description className="dialog-description">{description}</DialogPrimitive.Description> : null}
        {children}
        {showClose ? <DialogPrimitive.Close className="dialog-close" aria-label="Close"><CloseIcon size={16}/></DialogPrimitive.Close> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
