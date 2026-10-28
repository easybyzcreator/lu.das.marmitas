import React from 'react';
import { motion } from 'motion/react';

export default function Footer() {
  return (
    <footer className="w-full py-8 flex flex-col items-center justify-center gap-4 mt-auto">
      <a 
        href="https://links.chefgabipaludo.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQPOTM2NjE5NzQzMzkyNDU5AAGnJRCKf_VEAmsGJnELOZPDdjtFN9gE6KJiIMIWlItrw3OPJN7DpGcv9562G9s_aem_qLFkDEcXheET3uWmK1wM2Q"
        target="_blank" 
        rel="noopener noreferrer"
        className="mb-4 flex flex-col items-center justify-center rounded-2xl bg-white border-2 border-[#424733]/80 hover:bg-white/95 active:scale-98 transition-all text-center w-[210px] h-[85px] cursor-pointer shadow-lg overflow-hidden px-3 py-1"
      >
        <span className="text-[9px] font-bold tracking-[0.25em] text-gray-400 uppercase -mt-1.5">
          ALUNO(A)/MENTORADO(A)
        </span>
        <div className="w-full flex items-center justify-center h-[48px] overflow-hidden mt-1">
          <img 
            src="https://i.ibb.co/JR6kgWZV/egn.png" 
            alt="egn" 
            className="h-[140px] w-auto object-contain max-w-none transform scale-[1.65]"
            referrerPolicy="no-referrer"
          />
        </div>
      </a>

      <p className="text-[10px] tracking-[0.2em] font-sans font-bold text-[#424733] uppercase mt-1">
        DESENVOLVIDO POR
      </p>
      <a 
        href="https://www.easybyzcreator.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="group mt-2"
      >
        <motion.img 
          src="https://i.ibb.co/Kj1CTDrD/patitour-2026-04-11-T125246-010.png" 
          alt="Logotipo EasyByz" 
          className="h-[158px] object-contain"
          initial={{ 
            filter: 'brightness(0) saturate(100%) invert(14%) sepia(100%) saturate(255%) hue-rotate(34deg) brightness(91%) contrast(68%) opacity(0.8)',
            scale: 0.95
          }}
          whileHover={{ 
            filter: 'brightness(0) saturate(100%) invert(14%) sepia(100%) saturate(255%) hue-rotate(34deg) brightness(91%) contrast(68%) opacity(1)',
            scale: 1.05
          }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          referrerPolicy="no-referrer"
        />
      </a>
    </footer>
  );
}
