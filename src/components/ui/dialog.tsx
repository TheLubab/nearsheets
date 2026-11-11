import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
// shadcn/ui dialog composition, styled using the shared application tokens.
export function Dialog({open,onOpenChange,title,description,children}:{open:boolean;onOpenChange(open:boolean):void;title:string;description:string;children:ReactNode}) {
  const previousOpen=useRef(false), opener=useRef<HTMLElement|null>(null);
  if(open && !previousOpen.current) opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  previousOpen.current=open;
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content className="dialog-content" onCloseAutoFocus={event=>{event.preventDefault();if(opener.current?.isConnected)opener.current.focus();else document.querySelector<HTMLElement>('[data-document-menu-trigger]')?.focus();}}>
        <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="dialog-description">{description}</DialogPrimitive.Description>
        {children}
        <DialogPrimitive.Close className="dialog-close" aria-label="Close"><X size={16}/></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
