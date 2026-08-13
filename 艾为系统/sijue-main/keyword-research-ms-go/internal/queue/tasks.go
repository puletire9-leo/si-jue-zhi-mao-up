package queue

import "encoding/json"

const (
	TaskTypeKeywordResearch = "keyword:research"
)

func NewKeywordResearchTask(taskID string) (*TaskPayload, error) {
	return &TaskPayload{TaskID: taskID}, nil
}

type TaskPayload struct {
	TaskID string `json:"task_id"`
}

func (p TaskPayload) Marshal() ([]byte, error) {
	return json.Marshal(p)
}

func UnmarshalTaskPayload(data []byte) (TaskPayload, error) {
	var p TaskPayload
	err := json.Unmarshal(data, &p)
	return p, err
}

