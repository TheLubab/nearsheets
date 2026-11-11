import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseIcon } from '@solar-icons/react/linear/close';
import { useRef } from 'react';
import type { ReactNode } from 'react';
// shadcn/ui dialog composition, styled using the shared application tokens.
export function Dialog({open,onOpenChange,title,description,children,className,showClose = true}:{open:boolean;onOpenChange(open:boolean):void;title:string;description?:string;children:ReactNode;className?:string;showClose?:boolean}) {
  const previousOpen=useRef(false), opener=useRef<HTMLElement|null>(null);
  if(open && !previousOpen.current) opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  previousOpen.current=open;
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content className={`dialog-content${className ? ` ${className}` : ''}`} {...(!description ? {'aria-describedby': undefined} : {})} onCloseAutoFocus={event=>{event.preventDefault();if(opener.current?.isConnected)opener.current.focus();else document.querySelector<HTMLElement>('[data-document-menu-trigger]')?.focus();}}>
        <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
        {description ? <DialogPrimitive.Description className="dialog-description">{description}</DialogPrimitive.Description> : null}
        {children}
        {showClose ? <DialogPrimitive.Close className="dialog-close" aria-label="Close"><CloseIcon size={16}/></DialogPrimitive.Close> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
