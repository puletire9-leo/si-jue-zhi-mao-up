package api

import (
	"net/http"
	"time"

	"keyword-research-ms-go/internal/models"
	"keyword-research-ms-go/internal/queue"
	"keyword-research-ms-go/internal/store"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

type Server struct {
	store       *store.Store
	asynqClient *asynq.Client
	defaultOpts models.ResearchOptions
}

func NewServer(st *store.Store, client *asynq.Client, defaults models.ResearchOptions) *Server {
	return &Server{
		store:       st,
		asynqClient: client,
		defaultOpts: defaults,
	}
}

func (s *Server) Router() *gin.Engine {
	r := gin.Default()
	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	r.POST("/v1/tasks/keyword-research", s.createTask)
	r.GET("/v1/tasks/:taskId", s.getTask)
	r.GET("/v1/tasks/:taskId/results", s.getTaskResult)
	r.POST("/v1/tasks/:taskId/retry", s.retryTask)
	return r
}

func (s *Server) createTask(c *gin.Context) {
	var req models.TaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Options = models.ApplyDefaultOptions(req.Options, s.defaultOpts)
	taskID := "krgo_" + uuid.NewString()
	if err := s.store.CreateTask(taskID, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	p := queue.TaskPayload{TaskID: taskID}
	payload, _ := p.Marshal()
	task := asynq.NewTask(queue.TaskTypeKeywordResearch, payload)
	if _, err := s.asynqClient.Enqueue(task, asynq.Queue("keyword_research"), asynq.Timeout(30*time.Minute)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	state, err := s.store.GetTask(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, state)
}

func (s *Server) getTask(c *gin.Context) {
	taskID := c.Param("taskId")
	state, err := s.store.GetTask(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if state == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	c.JSON(http.StatusOK, state)
}

func (s *Server) getTaskResult(c *gin.Context) {
	taskID := c.Param("taskId")
	view, err := s.store.GetTaskResult(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if view == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	c.JSON(http.StatusOK, view)
}

func (s *Server) retryTask(c *gin.Context) {
	taskID := c.Param("taskId")
	req, err := s.store.GetTaskPayload(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if req == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	_ = s.store.UpdateTaskStatus(taskID, models.TaskQueued, nil)
	p := queue.TaskPayload{TaskID: taskID}
	payload, _ := p.Marshal()
	task := asynq.NewTask(queue.TaskTypeKeywordResearch, payload)
	if _, err := s.asynqClient.Enqueue(task, asynq.Queue("keyword_research"), asynq.Timeout(30*time.Minute)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	state, _ := s.store.GetTask(taskID)
	c.JSON(http.StatusOK, state)
}

