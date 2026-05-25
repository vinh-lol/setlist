"use client";

interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

export default function TimePicker({ value, onChange }: Props) {
  const timeString = value.toTimeString().slice(0, 5); // "HH:MM"

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [hours, minutes] = e.target.value.split(":").map(Number);
    const next = new Date(value);
    next.setHours(hours, minutes, 0, 0);
    onChange(next);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-zinc-500 text-sm whitespace-nowrap">Party starts</label>
      <input
        type="time"
        value={timeString}
        onChange={handleChange}
        className="bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
      />
    </div>
  );
}
