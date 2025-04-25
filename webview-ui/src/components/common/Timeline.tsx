import React, { useState, useMemo } from "react"
import styled from "styled-components"
import Tooltip from "./Tooltip"
import { CheckpointOverlay } from "./CheckpointControls"
import { ClineMessage } from "@shared/ExtensionMessage"
import { formatTimestamp } from "@/utils/format"
import { vscode } from "@/utils/vscode"
import { ClineCheckpointRestore } from "@shared/WebviewMessage"

interface TimelineProps {
	messages: ClineMessage[]
}

const TimelineContainer = styled.div`
	position: relative;
	width: 95%;
	height: 65px;
	margin-top: 10px;
	padding: 5px 10px;
	display: flex;
	align-items: center;
	border: 1px solid var(--vscode-editorGroup-border);
	background-color: rgba(0, 0, 0, 0.2);
`

const TimelineLine = styled.div`
	position: absolute;
	top: 50%;
	left: 20px;
	right: 35px;
	height: 2px;
	background-color: var(--vscode-editorGroup-border);
	z-index: 1;
`

const TimelineItemsContainer = styled.div`
	display: flex;
	width: 100%;
	position: relative;
	z-index: 2;
	justify-content: space-between;
	padding: 0 10px;

	@media (max-width: 768px) {
		justify-content: flex-start;
		gap: 10px;
	}
`

const TimelineItem = styled.div<{
	itemType: "user_feedback" | "checkpoint" | "task_completed"
	isSelected?: boolean
}>`
	position: relative;
	width: 30px;
	height: 30px;
	border-radius: 50%;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	transition: border 0.2s ease-in-out;
	${(props) =>
		props.isSelected &&
		`
		border: 2px solid rgba(0, 120, 215, 0.5);
	`}

	${(props) =>
		props.itemType === "user_feedback" &&
		`
	   background-color: rgb(54, 25, 134);
	   color: white;
	 `}

	${(props) =>
		props.itemType === "checkpoint" &&
		`
	   background-color: rgb(40,40,40);
	   color: rgb(200,200,200);
	 `}
	 
	 ${(props) =>
		props.itemType === "task_completed" &&
		`
	   background-color: rgb(10, 51, 24);
	   color: white;
	 `}
`
const TimelineItemWrapper = styled.div`
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	min-width: 30px;
	margin: 0 5px;
`

const getItemType = (message: ClineMessage): "user_feedback" | "checkpoint" | "task_completed" => {
	if (message.say === "user_feedback") {
		return "user_feedback"
	}

	if (message.say === "checkpoint_created") {
		return "checkpoint"
	}

	if (message.say === "completion_result" || message.ask === "completion_result") {
		return "task_completed"
	}

	return "user_feedback"
}

const getItemIcon = (itemType: "user_feedback" | "checkpoint" | "task_completed"): string => {
	switch (itemType) {
		case "user_feedback":
			return "comment"
		case "checkpoint":
			return "bookmark"
		case "task_completed":
			return "check"
		default:
			return "circle-small"
	}
}

const Timeline: React.FC<TimelineProps> = ({ messages }) => {
	const [hoveredItem, setHoveredItem] = useState<number | null>(null)
	const [selectedCheckpoint, setSelectedCheckpoint] = useState<number | null>(null)
	const [restoredCheckpoint, setRestoredCheckpoint] = useState<number | null>(null)

	const timelineItems = useMemo(() => {
		const messageTypes = messages.map((m) => {
			if (m.type === "say") return m.say
			if (m.type === "ask") return m.ask
			return "unknown"
		})
		console.log("All message types:", [...new Set(messageTypes)])

		const userMessages = messages.filter((m) => m.say === "user_feedback" && m.text && m.text.trim().length > 0)
		const checkpointMessages = messages.filter(
			(m) => (m.type === "say" && m.say === "checkpoint_created") || m.lastCheckpointHash,
		)
		const completionMessages = messages.filter((m) => m.type === "say" && m.say === "completion_result")

		const milestones = [...userMessages, ...checkpointMessages, ...completionMessages]
		milestones.sort((a, b) => a.ts - b.ts)
		const uniqueMilestones = milestones.filter((item, index, self) => index === self.findIndex((t) => t.ts === item.ts))

		if (messages.length > 0) {
			const startingNode = {
				...userMessages[0],
				ts: Math.max(0, milestones[0]?.ts - 1000) || 0,
				text: "Starting Node", // Need to impute Task later
			}
			uniqueMilestones.unshift(startingNode)
		}

		return uniqueMilestones
	}, [messages])

	return (
		<TimelineContainer>
			<TimelineLine />
			<div
				style={{
					position: "absolute",
					top: 5,
					left: 20,
					color: "var(--vscode-foreground)",
					fontSize: "12px",
					fontWeight: "bold",
				}}>
				Timeline
			</div>
			<TimelineItemsContainer>
				{timelineItems.map((item) => {
					const itemType = getItemType(item)

					return (
						<TimelineItemWrapper key={item.ts}>
							<TimelineItem
								itemType={itemType}
								isSelected={restoredCheckpoint === item.ts}
								onMouseEnter={() => setHoveredItem(item.ts)}
								onMouseLeave={() => setHoveredItem(null)}
								onClick={() => {
									if (itemType === "checkpoint") {
										if (selectedCheckpoint === item.ts) {
											vscode.postMessage({
												type: "checkpointRestore",
												number: item.ts,
												text: "workspace" satisfies ClineCheckpointRestore,
											})
											// Set the restored checkpoint to show the blue border
											setRestoredCheckpoint(item.ts)
										} else {
											setSelectedCheckpoint(item.ts)
										}
									}
								}}>
								<i className={`codicon codicon-${getItemIcon(itemType)}`} style={{ fontSize: "16px" }} />
							</TimelineItem>
							{selectedCheckpoint === item.ts && itemType === "checkpoint" && (
								<CheckpointOverlay messageTs={item.ts} />
							)}
						</TimelineItemWrapper>
					)
				})}
			</TimelineItemsContainer>
		</TimelineContainer>
	)
}

export default Timeline
