import React from "react";
import { Button } from "@/components/ui/button";

const commonEmojis = ['👍', '❤️', '😊', '🎉', '🚀', '✅', '❌', '🔥', '💡', '👀', '🙌', '💯'];

export default function EmojiPicker({ onSelect }) {
  return (
    <div className="absolute bottom-full mb-2 right-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1 z-10">
      {commonEmojis.map(emoji => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          onClick={() => onSelect(emoji)}
          className="h-8 w-8 p-0 text-lg hover:bg-slate-100"
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}