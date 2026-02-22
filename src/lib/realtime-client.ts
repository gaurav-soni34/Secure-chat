"use client"

import {createRealtime} from "@upstash/realtime/client"
import {RealtimeEvents} from "./realtime"

export const {useRealtime}=createRealtime<RealtimeEvents>()