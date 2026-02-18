// src/types/imap-simple.d.ts

declare module 'imap-simple' {
    import { EventEmitter } from 'events';
    import { Config as ImapConfig } from 'imap';

    export interface ImapSimpleOptions {
        imap: ImapConfig;
        onmail?: (numNewMail: number) => void;
        onupdate?: (seqno: number, info: any) => void;
        onexpunge?: (seqno: number) => void;
    }

    export interface Message {
        attributes: any;
        parts: any[];
    }

    export interface ImapSimple extends EventEmitter {
        openBox(boxName: string): Promise<string>;
        search(criteria: any[], fetchOptions: any): Promise<Message[]>;
        end(): void;
        // Adicione outros métodos conforme a necessidade do seu código Go portado
    }

    export function connect(options: ImapSimpleOptions): Promise<ImapSimple>;
}