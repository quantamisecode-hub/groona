import * as React from "react";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

/**
 * TimePicker - An interactive clock component
 * @param {string} value - Time string in HH:mm format (24h)
 * @param {function} onChange - Callback function(value)
 */
export function TimePicker({ value = "09:00", onChange, className }) {
    const [isOpen, setIsOpen] = React.useState(false);

    // Parse initial value
    const parseTime = (val) => {
        if (!val || typeof val !== 'string' || !val.includes(':')) return [9, 0];
        const [h, m] = val.split(":").map(v => parseInt(v));
        return [isNaN(h) ? 9 : h, isNaN(m) ? 0 : m];
    };

    const [hours, setHours] = React.useState(() => parseTime(value)[0]);
    const [minutes, setMinutes] = React.useState(() => parseTime(value)[1]);

    // Synchronize state with prop if it changes externally
    React.useEffect(() => {
        if (value) {
            const [h, m] = parseTime(value);
            setHours(h);
            setMinutes(m);
        }
    }, [value]);

    const updateTime = (newH, newM) => {
        const h = Math.max(0, Math.min(23, newH));
        const m = Math.max(0, Math.min(59, newM));
        setHours(h);
        setMinutes(m);
        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onChange?.(formatted);
    };

    const isPM = hours >= 12;
    const displayHours = hours % 12 || 12;

    const toggleAMPM = () => {
        if (isPM) {
            updateTime(hours - 12, minutes);
        } else {
            updateTime(hours + 12, minutes);
        }
    };

    const handleClockClick = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const x = event.clientX - rect.left - centerX;
        const y = event.clientY - rect.top - centerY;

        // Calculate angle in radians, then degrees
        let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        // Determine if we are clicking near the hours or minutes (simple toggle or based on distance)
        const dist = Math.sqrt(x * x + y * y);
        const isMinuteArea = dist > rect.width * 0.3;

        if (isMinuteArea) {
            // 360 degrees / 60 minutes = 6 degrees per minute
            let m = Math.round(angle / 6) % 60;
            updateTime(hours, m);
        } else {
            // 360 degrees / 12 hours = 30 degrees per hour
            let h12 = Math.round(angle / 30) % 12 || 12;
            let finalH = isPM ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
            updateTime(finalH, minutes);
        }
    };

    return (
        <div className={cn("relative", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isOpen}
                        className="w-full justify-between font-normal"
                    >
                        <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {displayHours}:{String(minutes).padStart(2, '0')} {isPM ? 'PM' : 'AM'}
                        </span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4" align="start">
                    <div className="flex flex-col gap-4 items-center">
                        {/* Digital Inputs */}
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col items-center">
                                <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => updateTime(hours + 1 > 23 ? 0 : hours + 1, minutes)}
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Input
                                    className="w-12 text-center h-8"
                                    value={displayHours}
                                    readOnly
                                />
                                <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => updateTime(hours - 1 < 0 ? 23 : hours - 1, minutes)}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </div>
                            <span className="text-xl font-bold">:</span>
                            <div className="flex flex-col items-center">
                                <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => updateTime(hours, minutes + 5 >= 60 ? 0 : minutes + 5)}
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Input
                                    className="w-12 text-center h-8"
                                    value={String(minutes).padStart(2, '0')}
                                    readOnly
                                />
                                <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => updateTime(hours, minutes - 5 < 0 ? 55 : minutes - 5)}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </div>
                            <Button
                                variant="outline"
                                className="ml-2 h-8 w-12 text-xs font-bold"
                                onClick={toggleAMPM}
                            >
                                {isPM ? 'PM' : 'AM'}
                            </Button>
                        </div>

                        {/* Analog Clock Face */}
                        <div
                            className="relative w-40 h-40 rounded-full border-2 border-muted bg-muted/20 cursor-crosshair group"
                            onClick={handleClockClick}
                        >
                            {/* Clock Numbers */}
                            {[...Array(12)].map((_, i) => {
                                const angle = (i + 1) * 30 * (Math.PI / 180);
                                const x = 50 + 40 * Math.sin(angle);
                                const y = 50 - 40 * Math.cos(angle);
                                return (
                                    <span
                                        key={i}
                                        className="absolute text-[10px] font-bold text-muted-foreground -translate-x-1/2 -translate-y-1/2"
                                        style={{ left: `${x}%`, top: `${y}%` }}
                                    >
                                        {i + 1}
                                    </span>
                                );
                            })}

                            {/* Center Dot */}
                            <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-primary rounded-full -translate-x-1/2 -translate-y-1/2 z-10" />

                            {/* Hour Needle */}
                            <div
                                className="absolute top-1/2 left-1/2 w-1 h-12 bg-primary/60 rounded-full origin-bottom -translate-x-1/2 -translate-y-full transition-transform duration-200"
                                style={{ transform: `translate(-50%, -100%) rotate(${(displayHours % 12) * 30 + minutes * 0.5}deg)` }}
                            />

                            {/* Minute Needle */}
                            <div
                                className="absolute top-1/2 left-1/2 w-0.5 h-16 bg-primary rounded-full origin-bottom -translate-x-1/2 -translate-y-full transition-transform duration-200"
                                style={{ transform: `translate(-50%, -100%) rotate(${minutes * 6}deg)` }}
                            />
                        </div>

                        <div className="text-[10px] text-muted-foreground italic">
                            Click on the clock to set time
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
